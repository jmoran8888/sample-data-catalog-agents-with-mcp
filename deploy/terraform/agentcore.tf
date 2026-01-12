# IAM Role for AgentCore Runtime
resource "aws_iam_role" "agentcore_runtime" {
  name = "catalog-agents-agentcore-runtime-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock-agentcore.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "catalog-agents-agentcore-runtime-role"
    Project     = "catalog-agents-demo"
    Environment = var.environment
    Owner       = var.owner
    CostCenter  = var.cost_center
    FISTarget   = "true"
  }
}

# IAM Policy for AgentCore Runtime
resource "aws_iam_role_policy" "agentcore_runtime" {
  name = "catalog-agents-agentcore-runtime-policy"
  role = aws_iam_role.agentcore_runtime.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "glue:GetDatabases",
          "glue:GetDatabase",
          "glue:GetTables",
          "glue:GetTable",
          "glue:GetPartitions",
          "glue:GetPartition"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchCheckLayerAvailability"
        ]
        Resource = "*"
      }
    ]
  })
}

# Note: ECR repositories for MCP servers are created automatically by
# bedrock-agentcore-starter-toolkit with randomized names (bedrock-agentcore-*)
# No need to pre-create them in Terraform

# Security Group for AgentCore Runtime
# AgentCore only needs outbound access to AWS services
resource "aws_security_group" "agentcore_runtime" {
  name_prefix = "catalog-agents-agentcore-"
  vpc_id      = aws_vpc.main.id

  # No inbound rules - AgentCore is invoked via AWS API, not direct network access

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow outbound to AWS services"
  }

  tags = {
    Name        = "catalog-agents-agentcore-sg"
    Project     = "catalog-agents-demo"
    Environment = var.environment
    Owner       = var.owner
    CostCenter  = var.cost_center
    FISTarget   = "true"
  }
}
