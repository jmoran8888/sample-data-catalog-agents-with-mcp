from aws_cdk import (
    Stack,
    aws_ecs as ecs,
    aws_ec2 as ec2,
    aws_logs as logs,
    aws_elasticloadbalancingv2 as elbv2,
    aws_iam as iam,
    aws_rds as rds,
    aws_ecr as ecr,
    CfnParameter,
    Duration,
)
from constructs import Construct


class EcsServicesStack(Stack):
    """ECS Services Stack - Task Definitions and Services for Unity Catalog and Streamlit"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.Vpc,
        cluster: ecs.Cluster,
        ecs_security_group: ec2.SecurityGroup,
        task_execution_role: iam.Role,
        task_role: iam.Role,
        unity_target_group: elbv2.ApplicationTargetGroup,
        streamlit_target_group: elbv2.ApplicationTargetGroup,
        database: rds.DatabaseInstance,
        streamlit_repository: ecr.Repository,
        alb_dns_name: str,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Parameters
        self.unity_catalog_image = CfnParameter(
            self,
            "UnityCatalogImage",
            type="String",
            description="Unity Catalog Docker image",
            default="unitycatalog/unitycatalog:latest"
        )

        self.streamlit_image_tag = CfnParameter(
            self,
            "StreamlitImageTag",
            type="String",
            description="Streamlit app image tag",
            default="latest"
        )

        self.db_username = CfnParameter(
            self,
            "DBUsername",
            type="String",
            description="Database username",
            default="unitycatalog"
        )

        self.db_password = CfnParameter(
            self,
            "DBPassword",
            type="String",
            description="Database password",
            default="ChangeThisSecurePassword123!",
            no_echo=True
        )

        self.aws_region = CfnParameter(
            self,
            "AWSRegion",
            type="String",
            description="AWS region",
            default="us-east-1"
        )

        # CloudWatch Log Groups
        unity_log_group = logs.LogGroup(
            self,
            "UnityCatalogLogGroup",
            log_group_name="/ecs/unity-catalog",
            retention=logs.RetentionDays.ONE_WEEK
        )

        streamlit_log_group = logs.LogGroup(
            self,
            "StreamlitLogGroup",
            log_group_name="/ecs/streamlit-app",
            retention=logs.RetentionDays.ONE_WEEK
        )

        # Unity Catalog Task Definition
        unity_task_definition = ecs.FargateTaskDefinition(
            self,
            "UnityCatalogTaskDefinition",
            family="unity-catalog",
            cpu=1024,
            memory_limit_mib=2048,
            execution_role=task_execution_role,
            task_role=task_role
        )

        unity_container = unity_task_definition.add_container(
            "UnityCatalogContainer",
            image=ecs.ContainerImage.from_registry(self.unity_catalog_image.value_as_string),
            container_name="unity-catalog",
            environment={
                "UNITY_CATALOG_DB_URL": f"jdbc:postgresql://{database.db_instance_endpoint_address}:5432/unitycatalog",
                "UNITY_CATALOG_DB_USER": self.db_username.value_as_string,
                "UNITY_CATALOG_DB_PASSWORD": self.db_password.value_as_string
            },
            logging=ecs.LogDriver.aws_logs(
                stream_prefix="ecs",
                log_group=unity_log_group
            ),
            port_mappings=[
                ecs.PortMapping(
                    container_port=8080,
                    protocol=ecs.Protocol.TCP
                )
            ]
        )

        # Streamlit App Task Definition
        streamlit_task_definition = ecs.FargateTaskDefinition(
            self,
            "StreamlitTaskDefinition",
            family="streamlit-app",
            cpu=512,
            memory_limit_mib=1024,
            execution_role=task_execution_role,
            task_role=task_role
        )

        streamlit_container = streamlit_task_definition.add_container(
            "StreamlitContainer",
            image=ecs.ContainerImage.from_ecr_repository(
                repository=streamlit_repository,
                tag=self.streamlit_image_tag.value_as_string
            ),
            container_name="streamlit-app",
            environment={
                "UNITY_CATALOG_URL": f"http://{alb_dns_name}/api/2.1/unity-catalog",
                "AWS_DEFAULT_REGION": self.aws_region.value_as_string
            },
            logging=ecs.LogDriver.aws_logs(
                stream_prefix="ecs",
                log_group=streamlit_log_group
            ),
            port_mappings=[
                ecs.PortMapping(
                    container_port=8501,
                    protocol=ecs.Protocol.TCP
                )
            ]
        )

        # Unity Catalog ECS Service
        self.unity_service = ecs.FargateService(
            self,
            "UnityCatalogService",
            cluster=cluster,
            task_definition=unity_task_definition,
            desired_count=1,
            service_name="unity-catalog-service",
            security_groups=[ecs_security_group],
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            assign_public_ip=False
        )

        # Attach Unity Catalog service to target group
        self.unity_service.attach_to_application_target_group(unity_target_group)

        # Streamlit App ECS Service
        self.streamlit_service = ecs.FargateService(
            self,
            "StreamlitService",
            cluster=cluster,
            task_definition=streamlit_task_definition,
            desired_count=1,
            service_name="streamlit-app-service",
            security_groups=[ecs_security_group],
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            assign_public_ip=False
        )

        # Attach Streamlit service to target group
        self.streamlit_service.attach_to_application_target_group(streamlit_target_group)

        # Add dependency - Streamlit should start after Unity Catalog
        self.streamlit_service.node.add_dependency(self.unity_service)
