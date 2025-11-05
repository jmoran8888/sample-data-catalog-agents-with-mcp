# ECR Repository for Streamlit App
resource "aws_ecr_repository" "streamlit_app" {
  name                 = "catalog-agents/streamlit-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "catalog-agents-streamlit-ecr"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "unity_catalog" {
  name              = "/ecs/unity-catalog"
  retention_in_days = 7

  tags = {
    Name = "unity-catalog-logs"
  }
}

resource "aws_cloudwatch_log_group" "streamlit" {
  name              = "/ecs/streamlit-app"
  retention_in_days = 7

  tags = {
    Name = "streamlit-app-logs"
  }
}

# Unity Catalog Task Definition
resource "aws_ecs_task_definition" "unity_catalog" {
  family                   = "unity-catalog"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "unity-catalog"
      image = var.unity_catalog_image
      
      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "UNITY_CATALOG_DB_URL"
          value = "jdbc:postgresql://${aws_db_instance.unity_catalog.endpoint}:5432/unitycatalog"
        },
        {
          name  = "UNITY_CATALOG_DB_USER"
          value = var.db_username
        },
        {
          name  = "UNITY_CATALOG_DB_PASSWORD"
          value = var.db_password
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.unity_catalog.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      essential = true
    }
  ])

  tags = {
    Name = "unity-catalog-task-definition"
  }
}

# Streamlit App Task Definition
resource "aws_ecs_task_definition" "streamlit_app" {
  family                   = "streamlit-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "streamlit-app"
      image = "${aws_ecr_repository.streamlit_app.repository_url}:${var.streamlit_image_tag}"
      
      portMappings = [
        {
          containerPort = 8501
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "UNITY_CATALOG_URL"
          value = "http://${aws_lb.main.dns_name}/api/2.1/unity-catalog"
        },
        {
          name  = "AWS_DEFAULT_REGION"
          value = var.aws_region
        },
        {
          name  = "UNITY_MCP_RUNTIME_ID"
          value = var.unity_mcp_runtime_id
        },
        {
          name  = "GLUE_MCP_RUNTIME_ID"
          value = var.glue_mcp_runtime_id
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.streamlit.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      essential = true
    }
  ])

  tags = {
    Name = "streamlit-app-task-definition"
  }
}

# Unity Catalog ECS Service
resource "aws_ecs_service" "unity_catalog" {
  name            = "unity-catalog-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.unity_catalog.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.unity_catalog.arn
    container_name   = "unity-catalog"
    container_port   = 8080
  }

  depends_on = [aws_lb_listener.main, aws_db_instance.unity_catalog]

  tags = {
    Name = "unity-catalog-service"
  }
}

# Streamlit App ECS Service
resource "aws_ecs_service" "streamlit_app" {
  name            = "streamlit-app-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.streamlit_app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.streamlit.arn
    container_name   = "streamlit-app"
    container_port   = 8501
  }

  depends_on = [aws_lb_listener.main, aws_ecs_service.unity_catalog]

  tags = {
    Name = "streamlit-app-service"
  }
}
