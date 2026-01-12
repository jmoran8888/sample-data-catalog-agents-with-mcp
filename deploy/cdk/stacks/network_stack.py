"""
Network Stack - VPC and Networking Resources
Equivalent to Terraform main.tf networking section
"""

from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    Tags
)
from constructs import Construct

class NetworkStack(Stack):
    """
    Creates VPC with public and private subnets, NAT Gateway
    Matches Terraform configuration exactly
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # VPC with same CIDR as Terraform
        self.vpc = ec2.Vpc(
            self, "MainVPC",
            vpc_name="catalog-agents-vpc",
            ip_addresses=ec2.IpAddresses.cidr("10.0.0.0/16"),
            max_azs=2,
            nat_gateways=1,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="catalog-agents-public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="catalog-agents-private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                )
            ],
            enable_dns_hostnames=True,
            enable_dns_support=True
        )
        
        # Tag subnets to match Terraform naming
        for i, subnet in enumerate(self.vpc.public_subnets):
            Tags.of(subnet).add("Name", f"catalog-agents-public-{i+1}")
            Tags.of(subnet).add("Type", "public")
        
        for i, subnet in enumerate(self.vpc.private_subnets):
            Tags.of(subnet).add("Name", f"catalog-agents-private-{i+1}")
            Tags.of(subnet).add("Type", "private")
        
        # Tag Internet Gateway
        for child in self.vpc.node.children:
            if isinstance(child, ec2.CfnInternetGateway):
                Tags.of(child).add("Name", "catalog-agents-igw")
        
        # Tag NAT Gateway EIP
        Tags.of(self.vpc).add("Name", "catalog-agents-vpc")
