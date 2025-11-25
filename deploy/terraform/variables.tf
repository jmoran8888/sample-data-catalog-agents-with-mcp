variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "owner" {
  description = "Resource owner"
  type        = string
  default     = "catalog-agents-team"
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "engineering"
}

variable "unity_catalog_image" {
  description = "Unity Catalog Docker image"
  type        = string
  default     = "unitycatalog/unitycatalog:latest"
}

variable "streamlit_image_tag" {
  description = "Streamlit app image tag"
  type        = string
  default     = "latest"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "unitycatalog"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
  default     = "ChangeThisSecurePassword123!"
}

variable "admin_email" {
  description = "Admin user email for Cognito"
  type        = string
}

variable "admin_temp_password" {
  description = "Temporary password for admin user"
  type        = string
  sensitive   = true
}
