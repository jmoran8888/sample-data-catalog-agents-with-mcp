output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "agentcore_role_arn" {
  description = "AgentCore Runtime IAM Role ARN"
  value       = aws_iam_role.agentcore_runtime.arn
}

output "agentcore_security_group_id" {
  description = "AgentCore Runtime Security Group ID"
  value       = aws_security_group.agentcore_runtime.id
}

output "private_subnet_ids" {
  description = "Private Subnet IDs for AgentCore"
  value       = jsonencode(aws_subnet.private[*].id)
}

output "bastion_instance_id" {
  description = "Bastion instance ID for SSM port forwarding"
  value       = aws_instance.bastion.id
}

output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "streamlit_url" {
  description = "URL for the Streamlit application"
  value       = "https://${aws_lb.main.dns_name}"
}

output "unity_catalog_api_url" {
  description = "URL for the Unity Catalog API"
  value       = "https://${aws_lb.main.dns_name}/api/2.1/unity-catalog"
}


output "ecr_repository_url" {
  description = "ECR repository URL for the Streamlit app"
  value       = aws_ecr_repository.streamlit_app.repository_url
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.unity_catalog.endpoint
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_names" {
  description = "ECS service names for FIS targeting"
  value = {
    unity_catalog = aws_ecs_service.unity_catalog.name
    streamlit_app = aws_ecs_service.streamlit_app.name
  }
}

output "security_group_ids" {
  description = "Security group IDs for FIS targeting"
  value = {
    ecs_tasks = aws_security_group.ecs_tasks.id
    alb       = aws_security_group.alb.id
    rds       = aws_security_group.rds.id
  }
}

output "subnet_ids" {
  description = "Subnet IDs for FIS targeting"
  value = {
    public  = aws_subnet.public[*].id
    private = aws_subnet.private[*].id
  }
}

output "glue_catalog_info" {
  description = "Glue catalog information for FIS targeting"
  value = {
    databases = {
      customer_db  = aws_glue_catalog_database.customer_db.name
      sales_db     = aws_glue_catalog_database.sales_db.name
      analytics_db = aws_glue_catalog_database.analytics_db.name
    }
    tables = {
      customer_profile   = "${aws_glue_catalog_database.customer_db.name}.${aws_glue_catalog_table.customer_profile.name}"
      customer_orders    = "${aws_glue_catalog_database.sales_db.name}.${aws_glue_catalog_table.customer_orders.name}"
      analytics_summary  = "${aws_glue_catalog_database.analytics_db.name}.${aws_glue_catalog_table.analytics_summary.name}"
    }
    s3_bucket = aws_s3_bucket.glue_data.bucket
  }
}

output "fis_experiment_role_arn" {
  description = "FIS experiment role ARN for chaos agent to use"
  value       = aws_iam_role.fis_experiment_role.arn
}

output "all_tagged_resources" {
  description = "Summary of all resources tagged for FIS experiments"
  value = {
    ecs_cluster    = aws_ecs_cluster.main.name
    ecs_services   = [aws_ecs_service.unity_catalog.name, aws_ecs_service.streamlit_app.name]
    rds_instance   = aws_db_instance.unity_catalog.identifier
    s3_bucket      = aws_s3_bucket.glue_data.bucket
    glue_databases = [aws_glue_catalog_database.customer_db.name, aws_glue_catalog_database.sales_db.name, aws_glue_catalog_database.analytics_db.name]
    vpc_id         = aws_vpc.main.id
  }
}
