#!/bin/bash
set -e

echo "🚀 Deploying Catalog Agents Demo with Cognito Authentication"

# Set default values
export AWS_REGION=${AWS_REGION:-us-east-1}
export ENVIRONMENT=${ENVIRONMENT:-dev}

# Check required variables
if [ -z "$ADMIN_EMAIL" ]; then
    echo "❌ ADMIN_EMAIL environment variable is required"
    echo "   Set it with: export ADMIN_EMAIL=your-email@example.com"
    exit 1
fi

if [ -z "$ADMIN_TEMP_PASSWORD" ]; then
    echo "❌ ADMIN_TEMP_PASSWORD environment variable is required"
    echo "   Set it with: export ADMIN_TEMP_PASSWORD=TempPass123!"
    exit 1
fi

# Generate secure database password if not provided
if [ -z "$DB_PASSWORD" ]; then
    export DB_PASSWORD=$(openssl rand -base64 32 | tr -d "/@\" ")
    echo "✅ Generated secure database password"
fi

echo "📋 Configuration:"
echo "   AWS Region: $AWS_REGION"
echo "   Environment: $ENVIRONMENT"
echo "   Admin Email: $ADMIN_EMAIL"

# Check prerequisites
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform is required but not installed. Aborting." >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }

# Check AWS credentials
aws sts get-caller-identity >/dev/null 2>&1 || { echo "❌ AWS credentials not configured. Run 'aws configure' first." >&2; exit 1; }

cd "$(dirname "$0")/../terraform"

# Initialize Terraform
echo "🔧 Initializing Terraform..."
terraform init

# Plan deployment
echo "📋 Planning deployment..."
terraform plan \
    -var="admin_email=$ADMIN_EMAIL" \
    -var="admin_temp_password=$ADMIN_TEMP_PASSWORD" \
    -var="db_password=$DB_PASSWORD" \
    -var="aws_region=$AWS_REGION" \
    -var="environment=$ENVIRONMENT" \
    -out=tfplan

# Apply deployment
echo "🚀 Deploying infrastructure..."
terraform apply tfplan

# Get outputs
ALB_DNS=$(terraform output -raw alb_dns_name)
ECR_REPO_URL=$(terraform output -raw ecr_repository_url)
COGNITO_DOMAIN=$(terraform output -raw cognito_domain)
LOGIN_URL=$(terraform output -raw admin_login_url)

echo "✅ Infrastructure deployed successfully!"

# Build and push Docker image
echo "🐳 Building and pushing Docker image..."
cd "$(dirname "$0")/../.."

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URL

# Build image
docker build -f docker/Dockerfile.streamlit -t catalog-agents-streamlit .

# Tag and push
docker tag catalog-agents-streamlit:latest $ECR_REPO_URL:latest
docker push $ECR_REPO_URL:latest

# Update ECS service
echo "🔄 Updating ECS service..."
cd "$(dirname "$0")/../terraform"
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)

aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service streamlit-app-service \
    --force-new-deployment \
    --region $AWS_REGION

echo "🎉 Deployment complete!"
echo ""
echo "📱 Access your application:"
echo "   Application URL: https://$ALB_DNS"
echo "   Login URL: $LOGIN_URL"
echo ""
echo "🔐 Login credentials:"
echo "   Email: $ADMIN_EMAIL"
echo "   Temporary Password: TempPass123!"
echo "   (You'll be prompted to change this on first login)"
echo ""
echo "⏳ Note: It may take a few minutes for the ECS service to update"
