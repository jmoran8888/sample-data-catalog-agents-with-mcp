# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "catalog-agents-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "catalog-agents-cluster"
  }
}

# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "catalog-agents-ecs-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port       = 8501
    to_port         = 8501
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "catalog-agents-ecs-sg"
  }
}

# Security Group for ALB (Internal - accessed via SSM port forwarding)
resource "aws_security_group" "alb" {
  name_prefix = "catalog-agents-alb-"
  vpc_id      = aws_vpc.main.id

  # HTTPS access from within VPC (for SSM port forwarding)
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "HTTPS from VPC for SSM access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "catalog-agents-alb-sg"
  }
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "catalog-agents-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "catalog-agents-ecs-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# IAM Role for ECS Tasks
resource "aws_iam_role" "ecs_task_role" {
  name = "catalog-agents-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "catalog-agents-ecs-task-role"
  }
}

# IAM Policy for Glue access
resource "aws_iam_policy" "glue_access" {
  name = "catalog-agents-glue-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "glue:GetDatabase",
          "glue:GetDatabases",
          "glue:GetTable",
          "glue:GetTables",
          "glue:GetPartition",
          "glue:GetPartitions",
          "glue:SearchTables"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "catalog-agents-glue-policy"
  }
}

# IAM Policy for Bedrock access
resource "aws_iam_policy" "bedrock_access" {
  name = "catalog-agents-bedrock-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:*:*:inference-profile/*",
          "arn:aws:bedrock:*::foundation-model/*"
        ]
      }
    ]
  })

  tags = {
    Name = "catalog-agents-bedrock-policy"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_bedrock_policy" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.bedrock_access.arn
}
