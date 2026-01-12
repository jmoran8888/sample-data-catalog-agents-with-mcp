from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    CfnParameter,
)
from constructs import Construct


class SecurityStack(Stack):
    """Security Stack - Security Groups and IP Whitelisting"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.Vpc,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Parameter for IP whitelist
        self.allowed_ip = CfnParameter(
            self,
            "AllowedIPAddress",
            type="String",
            description="Your IP address to allow access (CIDR format, e.g., 1.2.3.4/32)",
            allowed_pattern=r"^([0-9]{1,3}\.){3}[0-9]{1,3}/32$",
            constraint_description="Must be a valid IPv4 address in CIDR format (e.g., 1.2.3.4/32)"
        )

        # Security Group for ALB
        self.alb_security_group = ec2.SecurityGroup(
            self,
            "ALBSecurityGroup",
            vpc=vpc,
            description="Security group for Application Load Balancer",
            allow_all_outbound=True,
            security_group_name="catalog-agents-alb-sg"
        )

        # HTTP redirect (always allow for redirect to HTTPS)
        self.alb_security_group.add_ingress_rule(
            peer=ec2.Peer.any_ipv4(),
            connection=ec2.Port.tcp(80),
            description="HTTP redirect to HTTPS"
        )

        # HTTPS access from whitelisted IP only
        self.alb_security_group.add_ingress_rule(
            peer=ec2.Peer.ipv4(self.allowed_ip.value_as_string),
            connection=ec2.Port.tcp(443),
            description="Allow HTTPS from whitelisted IP only"
        )

        # Security Group for ECS Tasks
        self.ecs_tasks_security_group = ec2.SecurityGroup(
            self,
            "ECSTasksSecurityGroup",
            vpc=vpc,
            description="Security group for ECS tasks",
            allow_all_outbound=True,
            security_group_name="catalog-agents-ecs-sg"
        )

        # Allow traffic from ALB to Unity Catalog port
        self.ecs_tasks_security_group.add_ingress_rule(
            peer=ec2.Peer.security_group_id(self.alb_security_group.security_group_id),
            connection=ec2.Port.tcp(8080),
            description="Allow ALB to Unity Catalog"
        )

        # Allow traffic from ALB to Streamlit port
        self.ecs_tasks_security_group.add_ingress_rule(
            peer=ec2.Peer.security_group_id(self.alb_security_group.security_group_id),
            connection=ec2.Port.tcp(8501),
            description="Allow ALB to Streamlit"
        )

        # Security Group for RDS
        self.rds_security_group = ec2.SecurityGroup(
            self,
            "RDSSecurityGroup",
            vpc=vpc,
            description="Security group for RDS PostgreSQL",
            allow_all_outbound=True,
            security_group_name="unity-catalog-rds-sg"
        )

        # Allow PostgreSQL traffic from ECS tasks
        self.rds_security_group.add_ingress_rule(
            peer=ec2.Peer.security_group_id(self.ecs_tasks_security_group.security_group_id),
            connection=ec2.Port.tcp(5432),
            description="Allow PostgreSQL from ECS tasks"
        )

        # Security Group for AgentCore Runtime
        self.agentcore_security_group = ec2.SecurityGroup(
            self,
            "AgentCoreSecurityGroup",
            vpc=vpc,
            description="Security group for AgentCore Runtime",
            allow_all_outbound=True,
            security_group_name="catalog-agents-agentcore-sg"
        )
        # No inbound rules - AgentCore is invoked via AWS API
