# Security Best Practices

## Overview

This document outlines security best practices for deploying and managing the Catalog Agents Demo project on AWS infrastructure.

## ⚠️ Critical Security Requirements

### 1. Credentials Management

**NEVER commit the following files to version control:**
- `terraform.tfvars` - Contains actual variable values
- `terraform.tfstate` - Contains deployed infrastructure details
- `terraform.tfstate.backup` - Backup state file
- `tfplan` - Terraform execution plans
- `.env` files - Environment variables

These files are already listed in `.gitignore` and should remain there.

### 2. Password Security

**Database Passwords:**
- The default password in `variables.tf` is a placeholder only
- **MUST** be changed before deployment
- Recommended: Use AWS Secrets Manager or Systems Manager Parameter Store
- Minimum requirements: 8+ characters, mixed case, numbers, symbols

**Cognito Admin Password:**
- Temporary password is only for initial setup
- Users will be forced to change on first login
- Never share temporary passwords in documentation or code

### 3. Recommended: Use AWS Secrets Manager

Instead of hardcoding passwords in `terraform.tfvars`, use AWS Secrets Manager:

```hcl
# Example: Reference secrets in your terraform code
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "catalog-agents/db-password"
}

locals {
  db_password = data.aws_secretsmanager_secret_version.db_password.secret_string
}
```

Create secrets using AWS CLI:
```bash
aws secretsmanager create-secret \
  --name catalog-agents/db-password \
  --secret-string "YourSecurePassword123!"

aws secretsmanager create-secret \
  --name catalog-agents/admin-temp-password \
  --secret-string "YourSecureTempPassword123!"
```

### 4. Environment Variables

For local development, use environment variables instead of hardcoded values:

```bash
export TF_VAR_admin_email="your-email@example.com"
export TF_VAR_admin_temp_password="YourSecurePassword123!"
export TF_VAR_db_password="YourDBPassword123!"
```

### 5. IAM Permissions

Ensure proper IAM permissions are configured:
- Use least privilege principle
- Create service-specific IAM roles
- Enable MFA for administrative access
- Regularly rotate credentials

### 6. Network Security

- RDS database is in private subnets (not publicly accessible)
- Application Load Balancer handles HTTPS termination
- Security groups restrict traffic to necessary ports only
- Consider using AWS PrivateLink for enhanced security

### 7. Monitoring and Logging

Enable the following for security monitoring:
- CloudTrail for API audit logging
- VPC Flow Logs for network traffic analysis
- CloudWatch Logs for application logging
- AWS Config for configuration change tracking

## Deployment Checklist

Before deploying to production:

- [ ] Replace all placeholder passwords with secure values
- [ ] Store sensitive values in AWS Secrets Manager
- [ ] Enable CloudTrail logging
- [ ] Configure VPC Flow Logs
- [ ] Review and tighten security group rules
- [ ] Enable encryption at rest for RDS
- [ ] Enable encryption in transit (SSL/TLS)
- [ ] Set up proper backup and disaster recovery
- [ ] Configure AWS WAF for ALB protection
- [ ] Enable GuardDuty for threat detection
- [ ] Review IAM policies for least privilege
- [ ] Enable MFA for all administrative users

## Incident Response

If credentials are compromised:

1. **Immediately rotate all passwords and keys**
2. Review CloudTrail logs for unauthorized access
3. Check for any unauthorized resource creation
4. Update security groups to restrict access
5. Notify security team
6. Document the incident

## Additional Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Terraform Security Best Practices](https://www.terraform.io/docs/language/values/variables.html#suppressing-values-in-cli-output)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)

## Reporting Security Issues

If you discover a security vulnerability, please follow the instructions in [CONTRIBUTING.md](CONTRIBUTING.md#security-issue-notifications).
