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

# ECR Repository for MCP Server Images
resource "aws_ecr_repository" "unity_mcp" {
  name                 = "catalog-agents/unity-mcp"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "catalog-agents-unity-mcp"
    Project     = "catalog-agents-demo"
    Environment = var.environment
    Owner       = var.owner
    CostCenter  = var.cost_center
    FISTarget   = "true"
  }
}

resource "aws_ecr_repository" "glue_mcp" {
  name                 = "catalog-agents/glue-mcp"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "catalog-agents-glue-mcp"
    Project     = "catalog-agents-demo"
    Environment = var.environment
    Owner       = var.owner
    CostCenter  = var.cost_center
    FISTarget   = "true"
  }
}

# Security Group for AgentCore Runtime
<<<<<<< HEAD
=======
# AgentCore only needs outbound access to AWS services
>>>>>>> aws-infra
resource "aws_security_group" "agentcore_runtime" {
  name_prefix = "catalog-agents-agentcore-"
  vpc_id      = aws_vpc.main.id

<<<<<<< HEAD
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
=======
  # No inbound rules - AgentCore is invoked via AWS API, not direct network access
>>>>>>> aws-infra

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
<<<<<<< HEAD
=======
    description = "Allow outbound to AWS services"
>>>>>>> aws-infra
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
