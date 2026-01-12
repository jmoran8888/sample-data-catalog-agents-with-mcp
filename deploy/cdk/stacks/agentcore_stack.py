from aws_cdk import (
    Stack,
    aws_iam as iam,
    aws_ec2 as ec2,
    aws_ecr as ecr,
    CfnParameter,
)
from constructs import Construct
import aws_cdk as cdk


class AgentCoreStack(Stack):
    """AgentCore Stack - IAM Role and Security Group for AgentCore Runtime"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.Vpc,
        unity_mcp_repository: ecr.Repository,
        glue_mcp_repository: ecr.Repository,
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

        # IAM Role for AgentCore Runtime
        self.runtime_role = iam.Role(
            self,
            "AgentCoreRuntimeRole",
            assumed_by=iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
            role_name="catalog-agents-agentcore-runtime-role"
        )

        # IAM Policy for AgentCore Runtime
        runtime_policy = iam.Policy(
            self,
            "AgentCoreRuntimePolicy",
            policy_name="catalog-agents-agentcore-runtime-policy",
            statements=[
                # CloudWatch Logs permissions
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "logs:CreateLogGroup",
                        "logs:CreateLogStream",
                        "logs:PutLogEvents",
                        "logs:DescribeLogGroups",
                        "logs:DescribeLogStreams"
                    ],
                    resources=["arn:aws:logs:*:*:*"]
                ),
                # Glue permissions
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "glue:GetDatabases",
                        "glue:GetDatabase",
                        "glue:GetTables",
                        "glue:GetTable",
                        "glue:GetPartitions",
                        "glue:GetPartition"
                    ],
                    resources=["*"]
                ),
                # ECR permissions
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "ecr:GetAuthorizationToken",
                        "ecr:BatchGetImage",
                        "ecr:GetDownloadUrlForLayer",
                        "ecr:BatchCheckLayerAvailability"
                    ],
                    resources=["*"]
                )
            ]
        )

        self.runtime_role.attach_inline_policy(runtime_policy)

        # Security Group for AgentCore Runtime
        self.security_group = ec2.SecurityGroup(
            self,
            "AgentCoreSecurityGroup",
            vpc=vpc,
            description="Security group for AgentCore Runtime",
            allow_all_outbound=True,
            security_group_name="catalog-agents-agentcore-sg"
        )
        # No inbound rules - AgentCore is invoked via AWS API

        # Add tags
        cdk.Tags.of(self.runtime_role).add("Name", "catalog-agents-agentcore-runtime-role")
        cdk.Tags.of(self.runtime_role).add("Project", "catalog-agents-demo")
        cdk.Tags.of(self.runtime_role).add("Environment", self.environment.value_as_string)
        cdk.Tags.of(self.runtime_role).add("Owner", self.owner.value_as_string)
        cdk.Tags.of(self.runtime_role).add("CostCenter", self.cost_center.value_as_string)
        cdk.Tags.of(self.runtime_role).add("FISTarget", "true")

        cdk.Tags.of(self.security_group).add("Name", "catalog-agents-agentcore-sg")
        cdk.Tags.of(self.security_group).add("Project", "catalog-agents-demo")
        cdk.Tags.of(self.security_group).add("Environment", self.environment.value_as_string)
        cdk.Tags.of(self.security_group).add("Owner", self.owner.value_as_string)
        cdk.Tags.of(self.security_group).add("CostCenter", self.cost_center.value_as_string)
        cdk.Tags.of(self.security_group).add("FISTarget", "true")

        # Store repository references for use in deploy script
        self.unity_mcp_repository = unity_mcp_repository
        self.glue_mcp_repository = glue_mcp_repository
