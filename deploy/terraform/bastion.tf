# Bastion/Jump Host for SSM Port Forwarding
# Small instance used as SSM target to forward traffic to internal ALB

# Security Group for Bastion
resource "aws_security_group" "bastion" {
  name_prefix = "catalog-agents-bastion-"
  vpc_id      = aws_vpc.main.id

  # No inbound rules needed - access via SSM only

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "catalog-agents-bastion-sg"
  }
}

# IAM Role for Bastion (SSM access)
resource "aws_iam_role" "bastion" {
  name = "catalog-agents-bastion-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "catalog-agents-bastion-role"
  }
}

# Attach SSM managed policy for Session Manager
resource "aws_iam_role_policy_attachment" "bastion_ssm" {
  role       = aws_iam_role.bastion.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance Profile for Bastion
resource "aws_iam_instance_profile" "bastion" {
  name = "catalog-agents-bastion-profile"
  role = aws_iam_role.bastion.name
}

# Get latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Bastion EC2 Instance (minimal size)
resource "aws_instance" "bastion" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.nano"
  subnet_id              = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.bastion.id]
  iam_instance_profile   = aws_iam_instance_profile.bastion.name

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  tags = {
    Name = "catalog-agents-bastion"
  }
}
