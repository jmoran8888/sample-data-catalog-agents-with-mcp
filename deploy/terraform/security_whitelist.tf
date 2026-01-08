# IP Whitelist for ALB Access
# REQUIRED: This variable must be set in terraform.tfvars

variable "allowed_ip_address" {
  description = "Your IP address to allow access (auto-detected by deploy_aws.py)"
  type        = string
  
  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}$", var.allowed_ip_address))
    error_message = "The allowed_ip_address must be a valid IPv4 address (e.g., '1.2.3.4'). Run deploy_aws.py to auto-detect your IP."
  }
}

# Restrict ALB HTTPS access to whitelisted IP only
resource "aws_security_group_rule" "alb_https_whitelist" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["${var.allowed_ip_address}/32"]
  security_group_id = aws_security_group.alb.id
  description       = "Allow HTTPS from whitelisted IP only"
}
