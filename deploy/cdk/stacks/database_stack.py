from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    aws_rds as rds,
    CfnParameter,
    Duration,
)
from constructs import Construct


class DatabaseStack(Stack):
    """Database Stack - RDS PostgreSQL for Unity Catalog"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.Vpc,
        rds_security_group: ec2.SecurityGroup,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Parameters for database credentials
        self.db_username = CfnParameter(
            self,
            "DBUsername",
            type="String",
            description="Database username",
            default="unitycatalog",
            no_echo=False
        )

        self.db_password = CfnParameter(
            self,
            "DBPassword",
            type="String",
            description="Database password",
            default="ChangeThisSecurePassword123!",
            no_echo=True
        )

        # RDS Subnet Group
        db_subnet_group = rds.SubnetGroup(
            self,
            "DBSubnetGroup",
            vpc=vpc,
            description="Subnet group for Unity Catalog database",
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            subnet_group_name="unity-catalog-db-subnet-group"
        )

        # RDS PostgreSQL Instance
        self.database = rds.DatabaseInstance(
            self,
            "UnityCatalogDatabase",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_16
            ),
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE3,
                ec2.InstanceSize.MICRO
            ),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[rds_security_group],
            subnet_group=db_subnet_group,
            database_name="unitycatalog",
            credentials=rds.Credentials.from_password(
                username=self.db_username.value_as_string,
                password=self.db_password
            ),
            allocated_storage=20,
            max_allocated_storage=100,
            storage_type=rds.StorageType.GP2,
            storage_encrypted=True,
            backup_retention=Duration.days(7),
            preferred_backup_window="03:00-04:00",
            preferred_maintenance_window="sun:04:00-sun:05:00",
            deletion_protection=False,
            removal_policy=self.removal_policy,
            instance_identifier="unity-catalog-db"
        )
