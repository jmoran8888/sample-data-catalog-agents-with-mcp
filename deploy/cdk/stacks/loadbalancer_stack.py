from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    aws_elasticloadbalancingv2 as elbv2,
    aws_certificatemanager as acm,
    CfnParameter,
    Duration,
)
from constructs import Construct
import aws_cdk as cdk


class LoadBalancerStack(Stack):
    """Load Balancer Stack - ALB, Target Groups, and HTTPS Certificate"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.Vpc,
        alb_security_group: ec2.SecurityGroup,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Parameters for tagging
        self.environment = CfnParameter(
            self,
            "Environment",
            type="String",
            description="Environment name",
            default="dev"
        )

        self.owner = CfnParameter(
            self,
            "Owner",
            type="String",
            description="Resource owner",
            default="catalog-agents-team"
        )

        self.cost_center = CfnParameter(
            self,
            "CostCenter",
            type="String",
            description="Cost center for billing",
            default="engineering"
        )

        # Application Load Balancer
        self.alb = elbv2.ApplicationLoadBalancer(
            self,
            "MainALB",
            vpc=vpc,
            internet_facing=True,
            load_balancer_name="catalog-agents-alb",
            security_group=alb_security_group,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
            deletion_protection=False
        )

        # Target Group for Unity Catalog
        self.unity_target_group = elbv2.ApplicationTargetGroup(
            self,
            "UnityCatalogTargetGroup",
            vpc=vpc,
            port=8080,
            protocol=elbv2.ApplicationProtocol.HTTP,
            target_type=elbv2.TargetType.IP,
            target_group_name="unity-catalog-tg",
            health_check=elbv2.HealthCheck(
                enabled=True,
                healthy_threshold_count=2,
                interval=Duration.seconds(30),
                path="/docs",
                protocol=elbv2.Protocol.HTTP,
                timeout=Duration.seconds(5),
                unhealthy_threshold_count=2
            )
        )

        # Target Group for Streamlit
        self.streamlit_target_group = elbv2.ApplicationTargetGroup(
            self,
            "StreamlitTargetGroup",
            vpc=vpc,
            port=8501,
            protocol=elbv2.ApplicationProtocol.HTTP,
            target_type=elbv2.TargetType.IP,
            target_group_name="streamlit-tg",
            health_check=elbv2.HealthCheck(
                enabled=True,
                healthy_threshold_count=2,
                interval=Duration.seconds(30),
                path="/_stcore/health",
                protocol=elbv2.Protocol.HTTP,
                timeout=Duration.seconds(5),
                unhealthy_threshold_count=2
            )
        )

        # Self-signed certificate for ALB HTTPS
        # Note: We'll create the certificate using CfnCertificate with custom resource
        # For simplicity in CDK, we'll use the ALB's DNS name
        certificate = acm.Certificate(
            self,
            "ALBCertificate",
            domain_name=self.alb.load_balancer_dns_name,
            validation=acm.CertificateValidation.from_dns()
        )

        # HTTPS Listener (default action forwards to Streamlit)
        self.https_listener = self.alb.add_listener(
            "HTTPSListener",
            port=443,
            protocol=elbv2.ApplicationProtocol.HTTPS,
            certificates=[certificate],
            default_action=elbv2.ListenerAction.forward([self.streamlit_target_group]),
            ssl_policy=elbv2.SslPolicy.TLS12
        )

        # HTTP to HTTPS redirect listener
        self.http_listener = self.alb.add_listener(
            "HTTPListener",
            port=80,
            protocol=elbv2.ApplicationProtocol.HTTP,
            default_action=elbv2.ListenerAction.redirect(
                protocol="HTTPS",
                port="443",
                permanent=True
            )
        )

        # Listener Rule for Unity Catalog API
        self.https_listener.add_target_groups(
            "UnityCatalogRule",
            target_groups=[self.unity_target_group],
            priority=100,
            conditions=[
                elbv2.ListenerCondition.path_patterns([
                    "/api/*",
                    "/docs/*",
                    "/openapi.json"
                ])
            ]
        )

        # Add tags
        cdk.Tags.of(self.alb).add("Name", "catalog-agents-alb")
        cdk.Tags.of(self.alb).add("Project", "catalog-agents-demo")
        cdk.Tags.of(self.alb).add("Environment", self.environment.value_as_string)
        cdk.Tags.of(self.alb).add("Owner", self.owner.value_as_string)
        cdk.Tags.of(self.alb).add("CostCenter", self.cost_center.value_as_string)
        cdk.Tags.of(self.alb).add("FISTarget", "true")

        # Outputs
        cdk.CfnOutput(
            self,
            "ALBDnsName",
            value=self.alb.load_balancer_dns_name,
            description="ALB DNS Name"
        )

        cdk.CfnOutput(
            self,
            "ALBArn",
            value=self.alb.load_balancer_arn,
            description="ALB ARN"
        )
