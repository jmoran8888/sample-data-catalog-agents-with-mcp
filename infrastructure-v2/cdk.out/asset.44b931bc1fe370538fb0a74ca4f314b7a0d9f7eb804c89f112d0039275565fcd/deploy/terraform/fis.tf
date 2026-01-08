# IAM Role for FIS Experiments
resource "aws_iam_role" "fis_experiment_role" {
  name = "catalog-agents-fis-experiment-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "fis.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "catalog-agents-fis-role"
  }
}

# IAM Policy for FIS ECS Actions
resource "aws_iam_policy" "fis_ecs_policy" {
  name = "catalog-agents-fis-ecs-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:StopTask",
          "ecs:ListTasks",
          "ecs:DescribeTasks",
          "ecs:DescribeServices",
          "ecs:DescribeClusters"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:ResourceTag/FISTarget" = "true"
          }
        }
      }
    ]
  })

  tags = {
    Name = "catalog-agents-fis-ecs-policy"
  }
}

# IAM Policy for FIS EC2 Actions
resource "aws_iam_policy" "fis_ec2_policy" {
  name = "catalog-agents-fis-ec2-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:SendSpotInstanceInterruptions",
          "ec2:StopInstances",
          "ec2:RebootInstances"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:ResourceTag/FISTarget" = "true"
          }
        }
      }
    ]
  })

  tags = {
    Name = "catalog-agents-fis-ec2-policy"
  }
}

# IAM Policy for FIS RDS Actions
resource "aws_iam_policy" "fis_rds_policy" {
  name = "catalog-agents-fis-rds-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds:FailoverDBCluster",
          "rds:RebootDBInstance",
          "rds:DescribeDBClusters",
          "rds:DescribeDBInstances"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:ResourceTag/FISTarget" = "true"
          }
        }
      }
    ]
  })

  tags = {
    Name = "catalog-agents-fis-rds-policy"
  }
}

# IAM Policy for FIS S3 Actions
resource "aws_iam_policy" "fis_s3_policy" {
  name = "catalog-agents-fis-s3-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetBucketTagging",
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.glue_data.arn,
          "${aws_s3_bucket.glue_data.arn}/*"
        ]
      }
    ]
  })

  tags = {
    Name = "catalog-agents-fis-s3-policy"
  }
}

# Attach policies to FIS role
resource "aws_iam_role_policy_attachment" "fis_ecs_policy_attachment" {
  role       = aws_iam_role.fis_experiment_role.name
  policy_arn = aws_iam_policy.fis_ecs_policy.arn
}

resource "aws_iam_role_policy_attachment" "fis_ec2_policy_attachment" {
  role       = aws_iam_role.fis_experiment_role.name
  policy_arn = aws_iam_policy.fis_ec2_policy.arn
}

resource "aws_iam_role_policy_attachment" "fis_rds_policy_attachment" {
  role       = aws_iam_role.fis_experiment_role.name
  policy_arn = aws_iam_policy.fis_rds_policy.arn
}

resource "aws_iam_role_policy_attachment" "fis_s3_policy_attachment" {
  role       = aws_iam_role.fis_experiment_role.name
  policy_arn = aws_iam_policy.fis_s3_policy.arn
}
