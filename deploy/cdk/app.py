#!/usr/bin/env python3
"""
CDK App for Catalog Agents Demo
Deploys the same infrastructure as Terraform but using AWS CDK
"""

import aws_cdk as cdk
from stacks import (
    NetworkStack,
    SecurityStack,
    DatabaseStack,
    StorageStack,
    ComputeStack,
    LoadBalancerStack,
    EcsServicesStack,
    AgentCoreStack,
    GlueStack,
)

app = cdk.App()

# Environment configuration
env = cdk.Environment(
    account=app.node.try_get_context("account"),
    region=app.node.try_get_context("region") or "us-east-1"
)

# Phase 1: Network Stack - VPC, Subnets, NAT Gateway
network_stack = NetworkStack(
    app,
    "CatalogAgentsNetworkStack",
    env=env
)

# Phase 2: Security Stack - Security Groups and IP Whitelisting
security_stack = SecurityStack(
    app,
    "CatalogAgentsSecurityStack",
    vpc=network_stack.vpc,
    env=env
)
security_stack.add_dependency(network_stack)

# Phase 3: Storage Stack - S3 Buckets and ECR Repositories
storage_stack = StorageStack(
    app,
    "CatalogAgentsStorageStack",
    env=env
)

# Phase 4: Database Stack - RDS PostgreSQL
database_stack = DatabaseStack(
    app,
    "CatalogAgentsDatabaseStack",
    vpc=network_stack.vpc,
    rds_security_group=security_stack.rds_security_group,
    env=env
)
database_stack.add_dependency(security_stack)

# Phase 5: Compute Stack - ECS Cluster and IAM Roles
compute_stack = ComputeStack(
    app,
    "CatalogAgentsComputeStack",
    env=env
)

# Phase 6: Load Balancer Stack - ALB, Target Groups, HTTPS Certificate
loadbalancer_stack = LoadBalancerStack(
    app,
    "CatalogAgentsLoadBalancerStack",
    vpc=network_stack.vpc,
    alb_security_group=security_stack.alb_security_group,
    env=env
)
loadbalancer_stack.add_dependency(security_stack)

# Phase 7: ECS Services Stack - Task Definitions and Services
ecs_services_stack = EcsServicesStack(
    app,
    "CatalogAgentsEcsServicesStack",
    vpc=network_stack.vpc,
    cluster=compute_stack.cluster,
    ecs_security_group=security_stack.ecs_tasks_security_group,
    task_execution_role=compute_stack.task_execution_role,
    task_role=compute_stack.task_role,
    unity_target_group=loadbalancer_stack.unity_target_group,
    streamlit_target_group=loadbalancer_stack.streamlit_target_group,
    database=database_stack.database,
    streamlit_repository=storage_stack.streamlit_repository,
    alb_dns_name=loadbalancer_stack.alb.load_balancer_dns_name,
    env=env
)
ecs_services_stack.add_dependency(compute_stack)
ecs_services_stack.add_dependency(loadbalancer_stack)
ecs_services_stack.add_dependency(database_stack)

# Phase 8: AgentCore Stack - IAM Role and Security Group
agentcore_stack = AgentCoreStack(
    app,
    "CatalogAgentsAgentCoreStack",
    vpc=network_stack.vpc,
    unity_mcp_repository=storage_stack.unity_mcp_repository,
    glue_mcp_repository=storage_stack.glue_mcp_repository,
    env=env
)
agentcore_stack.add_dependency(storage_stack)

# Phase 9: Glue Stack - Glue Databases and Tables
glue_stack = GlueStack(
    app,
    "CatalogAgentsGlueStack",
    glue_data_bucket=storage_stack.glue_data_bucket,
    env=env
)
glue_stack.add_dependency(storage_stack)

app.synth()
