#!/usr/bin/env python3
"""
CDK App for Catalog Agents Demo
Deploys the same infrastructure as Terraform but using AWS CDK
"""

import aws_cdk as cdk
from stacks.network_stack import NetworkStack
from stacks.security_stack import SecurityStack
from stacks.database_stack import DatabaseStack
from stacks.storage_stack import StorageStack
from stacks.compute_stack import ComputeStack
from stacks.loadbalancer_stack import LoadBalancerStack
from stacks.ecs_services_stack import EcsServicesStack
from stacks.agentcore_stack import AgentCoreStack
from stacks.glue_stack import GlueStack

app = cdk.App()

# Get configuration from context
environment = app.node.try_get_context("environment") or "dev"
owner = app.node.try_get_context("owner") or "catalog-agents-team"
cost_center = app.node.try_get_context("cost_center") or "engineering"
allowed_ip = app.node.try_get_context("allowed_ip")

# Default tags for all resources
tags = {
    "Project": "catalog-agents-demo",
    "Environment": environment,
    "Owner": owner,
    "CostCenter": cost_center,
    "FISTarget": "true"
}

# Environment configuration
env = cdk.Environment(
    account=app.node.try_get_context("account"),
    region=app.node.try_get_context("region") or "us-east-1"
)

# Create stacks in dependency order
network_stack = NetworkStack(
    app, "CatalogAgentsNetworkStack",
    env=env,
    tags=tags
)

security_stack = SecurityStack(
    app, "CatalogAgentsSecurityStack",
    vpc=network_stack.vpc,
    allowed_ip=allowed_ip,
    env=env,
    tags=tags
)

database_stack = DatabaseStack(
    app, "CatalogAgentsDatabaseStack",
    vpc=network_stack.vpc,
    rds_security_group=security_stack.rds_security_group,
    environment=environment,
    env=env,
    tags=tags
)

storage_stack = StorageStack(
    app, "CatalogAgentsStorageStack",
    environment=environment,
    env=env,
    tags=tags
)

compute_stack = ComputeStack(
    app, "CatalogAgentsComputeStack",
    vpc=network_stack.vpc,
    ecs_tasks_security_group=security_stack.ecs_tasks_security_group,
    database=database_stack.database,
    streamlit_repository=storage_stack.streamlit_repository,
    environment=environment,
    env=env,
    tags=tags
)

loadbalancer_stack = LoadBalancerStack(
    app, "CatalogAgentsLoadBalancerStack",
    vpc=network_stack.vpc,
    alb_security_group=security_stack.alb_security_group,
    unity_target_group_target=compute_stack.unity_catalog_service,
    streamlit_target_group_target=compute_stack.streamlit_service,
    env=env,
    tags=tags
)

ecs_services_stack = EcsServicesStack(
    app, "CatalogAgentsEcsServicesStack",
    unity_catalog_service=compute_stack.unity_catalog_service,
    streamlit_service=compute_stack.streamlit_service,
    unity_target_group=loadbalancer_stack.unity_target_group,
    streamlit_target_group=loadbalancer_stack.streamlit_target_group,
    env=env,
    tags=tags
)

agentcore_stack = AgentCoreStack(
    app, "CatalogAgentsAgentCoreStack",
    vpc=network_stack.vpc,
    agentcore_security_group=security_stack.agentcore_security_group,
    environment=environment,
    env=env,
    tags=tags
)

glue_stack = GlueStack(
    app, "CatalogAgentsGlueStack",
    glue_data_bucket=storage_stack.glue_data_bucket,
    environment=environment,
    env=env,
    tags=tags
)

app.synth()
