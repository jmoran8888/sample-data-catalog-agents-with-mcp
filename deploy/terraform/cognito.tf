# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "catalog-agents-users"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  auto_verified_attributes = ["email"]

  username_attributes = ["email"]

  schema {
    attribute_data_type = "String"
    name               = "email"
    required           = true
    mutable            = true
  }

  tags = {
    Name        = "catalog-agents-user-pool"
    Project     = "catalog-agents-demo"
    Environment = var.environment
  }
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "catalog-agents-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = true

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls = [
    "https://${aws_lb.main.dns_name}/oauth2/idpresponse"
  ]

  logout_urls = [
    "https://${aws_lb.main.dns_name}/"
  ]

  supported_identity_providers = ["COGNITO"]

  depends_on = [aws_lb.main]

  lifecycle {
    ignore_changes = [callback_urls, logout_urls]
  }
}

# Cognito User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "catalog-agents-${random_string.cognito_domain.result}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Random string for unique domain
resource "random_string" "cognito_domain" {
  length  = 8
  special = false
  upper   = false
}

# Create a default admin user
resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = var.admin_email

  attributes = {
    email          = var.admin_email
    email_verified = true
  }

  temporary_password = var.admin_temp_password
  message_action     = "SUPPRESS"

  lifecycle {
    ignore_changes = [temporary_password]
  }
}
