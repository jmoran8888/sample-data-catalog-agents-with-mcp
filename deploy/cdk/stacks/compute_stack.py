from aws_cdk import (
    Stack,
    aws_ecs as ecs,
    aws_iam as iam,
    aws_ecr as ecr,
    CfnOutput,
)
from constructs import Construct


class ComputeStack(Stack):
    """Compute Stack - ECS Cluster and IAM Roles"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ECS Cluster
        self.cluster = ecs.Cluster(
            self,
            "MainCluster",
            cluster_name="catalog-agents-cluster",
            container_insights=True
        )

        # IAM Role for ECS Task Execution
        self.task_execution_role = iam.Role(
            self,
            "ECSTaskExecutionRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AmazonECSTaskExecutionRolePolicy"
                )
            ],
            role_name="catalog-agents-ecs-task-execution-role"
        )

        # IAM Role for ECS Tasks
        self.task_role = iam.Role(
            self,
            "ECSTaskRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            role_name="catalog-agents-ecs-task-role"
        )

        # IAM Policy for Glue access
        glue_policy = iam.Policy(
            self,
            "GlueAccessPolicy",
            policy_name="catalog-agents-glue-access",
            statements=[
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "glue:GetDatabase",
                        "glue:GetDatabases",
                        "glue:GetTable",
                        "glue:GetTables",
                        "glue:GetPartition",
                        "glue:GetPartitions",
                        "glue:SearchTables"
                    ],
                    resources=["*"]
                )
            ]
        )

        # IAM Policy for Bedrock access
        bedrock_policy = iam.Policy(
            self,
            "BedrockAccessPolicy",
            policy_name="catalog-agents-bedrock-access",
            statements=[
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "bedrock:InvokeModel",
                        "bedrock:InvokeModelWithResponseStream"
                    ],
                    resources=[
                        "arn:aws:bedrock:*:*:inference-profile/*",
                        "arn:aws:bedrock:*::foundation-model/*"
                    ]
                )
            ]
        )

        # Attach policies to task role
        self.task_role.attach_inline_policy(glue_policy)
        self.task_role.attach_inline_policy(bedrock_policy)

        # Outputs
        CfnOutput(
            self,
            "ClusterName",
            value=self.cluster.cluster_name,
            description="ECS Cluster Name"
        )

        CfnOutput(
            self,
            "TaskExecutionRoleArn",
            value=self.task_execution_role.role_arn,
            description="ECS Task Execution Role ARN"
        )

        CfnOutput(
            self,
            "TaskRoleArn",
            value=self.task_role.role_arn,
            description="ECS Task Role ARN"
        )
