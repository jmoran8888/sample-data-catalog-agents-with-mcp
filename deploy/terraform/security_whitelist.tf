# IP Whitelist for ALB Access
# For production use, restrict access to specific IP addresses

variable "allowed_ip_address" {
  description = "Your IP address to allow access (get with: curl ifconfig.me)"
  type        = string
  default     = ""  # Set this to your IP address (e.g., "1.2.3.4")
}

# Restrict ALB HTTPS access to whitelisted IP only
resource "aws_security_group_rule" "alb_https_whitelist" {
  count             = var.allowed_ip_address != "" ? 1 : 0
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["${var.allowed_ip_address}/32"]
  security_group_id = aws_security_group.alb.id
  description       = "Allow HTTPS from whitelisted IP only"
}

# If no IP whitelist is set, allow from anywhere (NOT RECOMMENDED for production)
resource "aws_security_group_rule" "alb_https_public" {
  count             = var.allowed_ip_address == "" ? 1 : 0
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
  description       = "Allow HTTPS from anywhere - SET allowed_ip_address for security!"
}
