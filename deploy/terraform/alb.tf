# Application Load Balancer
resource "aws_lb" "main" {
  name               = "catalog-agents-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "catalog-agents-alb"
  }
}

# Target Group for Unity Catalog
resource "aws_lb_target_group" "unity_catalog" {
  name        = "unity-catalog-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/docs"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "unity-catalog-target-group"
  }
}

# Target Group for Streamlit
resource "aws_lb_target_group" "streamlit" {
  name        = "streamlit-tg"
  port        = 8501
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/_stcore/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "streamlit-target-group"
  }
}

# Self-signed certificate for ALB HTTPS
resource "tls_private_key" "alb" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "alb" {
  private_key_pem = tls_private_key.alb.private_key_pem

  subject {
    common_name = aws_lb.main.dns_name
  }

  validity_period_hours = 8760 # 1 year

  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "server_auth",
  ]

  depends_on = [aws_lb.main]
}

resource "aws_acm_certificate" "alb" {
  private_key      = tls_private_key.alb.private_key_pem
  certificate_body = tls_self_signed_cert.alb.cert_pem

  tags = {
    Name        = "catalog-agents-alb-cert"
    Project     = "catalog-agents-demo"
    Environment = var.environment
    Owner       = var.owner
    CostCenter  = var.cost_center
    FISTarget   = "true"
  }
}

# ALB Listener with HTTPS and Cognito Authentication
resource "aws_lb_listener" "main" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.alb.arn

  default_action {
    type = "authenticate-cognito"
    order = 1

    authenticate_cognito {
      user_pool_arn              = aws_cognito_user_pool.main.arn
      user_pool_client_id        = aws_cognito_user_pool_client.main.id
      user_pool_domain           = aws_cognito_user_pool_domain.main.domain
      session_cookie_name        = "AWSELBAuthSessionCookie"
      session_timeout            = 86400
      on_unauthenticated_request = "authenticate"
    }
  }

  default_action {
    type             = "forward"
    order           = 2
    target_group_arn = aws_lb_target_group.streamlit.arn
  }

  tags = {
    Name = "catalog-agents-alb-listener"
  }
}

# HTTP to HTTPS redirect
resource "aws_lb_listener" "redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = {
    Name        = "catalog-agents-alb-redirect"
    Project     = "catalog-agents-demo"
    Environment = var.environment
    Owner       = var.owner
    CostCenter  = var.cost_center
    FISTarget   = "true"
  }
}

# ALB Listener Rule for Unity Catalog API (with auth)
resource "aws_lb_listener_rule" "unity_catalog" {
  listener_arn = aws_lb_listener.main.arn
  priority     = 100

  action {
    type = "authenticate-cognito"
    order = 1

    authenticate_cognito {
      user_pool_arn              = aws_cognito_user_pool.main.arn
      user_pool_client_id        = aws_cognito_user_pool_client.main.id
      user_pool_domain           = aws_cognito_user_pool_domain.main.domain
      session_cookie_name        = "AWSELBAuthSessionCookie"
      session_timeout            = 86400
      on_unauthenticated_request = "authenticate"
    }
  }

  action {
    type             = "forward"
    order           = 2
    target_group_arn = aws_lb_target_group.unity_catalog.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/docs/*", "/openapi.json"]
    }
  }

  tags = {
    Name = "unity-catalog-listener-rule"
  }
}
