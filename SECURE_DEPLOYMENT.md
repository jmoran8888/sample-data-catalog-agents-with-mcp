# Secure Deployment with Cognito Authentication

This deployment now includes AWS Cognito authentication to secure the Streamlit application and Unity Catalog API.

## Quick Deployment

1. **Set required environment variables:**
   ```bash
   export ADMIN_EMAIL="your-email@example.com"
   export ADMIN_TEMP_PASSWORD="TempPass123!"
   ```

2. **Deploy with AgentCore MCP servers:**
   ```bash
   ./deploy/scripts/deploy_agentcore.sh
   ```

   OR deploy without AgentCore:
   ```bash
   ./deploy/scripts/deploy.sh
   ```

## Security Features Added

- **Cognito User Pool**: Manages user authentication
- **ALB Authentication**: All requests require authentication before reaching applications
- **Secure Admin User**: Created automatically with your email
- **Password Policy**: Enforces strong passwords (8+ chars, mixed case, numbers, symbols)

## Access Your Application

After deployment, you'll get:
- **Application URL**: `http://your-alb-dns-name`
- **Login URL**: Direct link to Cognito login page
- **Admin Credentials**: Your email + temporary password

## First Login Process

1. Click the login URL provided after deployment
2. Enter your email and temporary password
3. You'll be prompted to set a new permanent password
4. After password change, you'll be redirected to the Streamlit app

## Managing Users

To add more users:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id $(cd deploy/terraform && terraform output -raw cognito_user_pool_id) \
  --username "new-user@example.com" \
  --user-attributes Name=email,Value="new-user@example.com" \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

## Troubleshooting

- **Can't access application**: Check that you're using the correct login URL
- **Authentication loops**: Clear browser cookies and try again
- **Password doesn't work**: Ensure it meets the password policy requirements

## Cleanup

To remove all resources:
```bash
./deploy/scripts/cleanup.sh
```
