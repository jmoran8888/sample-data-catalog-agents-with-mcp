from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_ecr as ecr,
    RemovalPolicy,
    CfnOutput,
)
from constructs import Construct


class StorageStack(Stack):
    """Storage Stack - S3 Buckets and ECR Repositories"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # S3 Bucket for Glue Catalog data
        self.glue_data_bucket = s3.Bucket(
            self,
            "GlueDataBucket",
            bucket_name=None,  # Auto-generate unique name
            versioned=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL
        )

        # ECR Repository for Streamlit App
        self.streamlit_repository = ecr.Repository(
            self,
            "StreamlitRepository",
            repository_name="catalog-agents/streamlit-app",
            image_tag_mutability=ecr.TagMutability.MUTABLE,
            image_scan_on_push=True,
            removal_policy=RemovalPolicy.DESTROY,
            empty_on_delete=True
        )

        # ECR Repository for Unity MCP Server
        self.unity_mcp_repository = ecr.Repository(
            self,
            "UnityMCPRepository",
            repository_name="catalog-agents/unity-mcp",
            image_tag_mutability=ecr.TagMutability.MUTABLE,
            image_scan_on_push=True,
            removal_policy=RemovalPolicy.DESTROY,
            empty_on_delete=True
        )

        # ECR Repository for Glue MCP Server
        self.glue_mcp_repository = ecr.Repository(
            self,
            "GlueMCPRepository",
            repository_name="catalog-agents/glue-mcp",
            image_tag_mutability=ecr.TagMutability.MUTABLE,
            image_scan_on_push=True,
            removal_policy=RemovalPolicy.DESTROY,
            empty_on_delete=True
        )

        # Outputs
        CfnOutput(
            self,
            "StreamlitRepositoryUri",
            value=self.streamlit_repository.repository_uri,
            description="Streamlit ECR Repository URI"
        )

        CfnOutput(
            self,
            "UnityMCPRepositoryUri",
            value=self.unity_mcp_repository.repository_uri,
            description="Unity MCP ECR Repository URI"
        )

        CfnOutput(
            self,
            "GlueMCPRepositoryUri",
            value=self.glue_mcp_repository.repository_uri,
            description="Glue MCP ECR Repository URI"
        )

        CfnOutput(
            self,
            "GlueDataBucketName",
            value=self.glue_data_bucket.bucket_name,
            description="Glue Data S3 Bucket Name"
        )
