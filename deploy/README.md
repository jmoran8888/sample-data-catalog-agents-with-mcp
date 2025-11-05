# AWS Deployment Guide

This directory contains everything needed to deploy the Catalog Agents Demo to AWS using ECS Fargate, with proper tagging for AWS Fault Injection Simulator (FIS) chaos experiments.

## Architecture

- **ECS Fargate**: Runs Unity Catalog and Streamlit applications
- **RDS PostgreSQL**: Metadata storage for Unity Catalog
- **Application Load Balancer**: Routes traffic to services
- **ECR**: Stores the Streamlit application container image
- **VPC**: Isolated network with public/private subnets
- **FIS**: Chaos engineering experiment templates

## Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Terraform** >= 1.0
3. **Docker** for building container images
4. **jq** for JSON processing (for cleanup script)

Required AWS permissions:
- ECS, ECR, RDS, VPC, IAM, CloudWatch, FIS
- Ability to create and manage these resources

## Quick Deployment

1. **Set environment variables** (optional):
   ```bash
   export AWS_REGION=us-east-1
   export ENVIRONMENT=dev
   export DB_PASSWORD=$(openssl rand -base64 32)
   ```

2. **Deploy everything**:
   ```bash
   ./scripts/deploy.sh
   ```

3. **Access your applications**:
   - Streamlit UI: `http://<alb-dns-name>`
   - Unity Catalog API: `http://<alb-dns-name>/api/2.1/unity-catalog`

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Initialize and Deploy Infrastructure

```bash
cd terraform
terraform init
terraform plan -var="db_password=YOUR_SECURE_PASSWORD"
terraform apply
```

### 2. Build and Push Container Image

```bash
# Get ECR repository URL
ECR_REPO_URL=$(terraform output -raw ecr_repository_url)

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO_URL

# Build and push image
cd ..
docker build -f docker/Dockerfile.streamlit -t catalog-agents-streamlit .
docker tag catalog-agents-streamlit:latest $ECR_REPO_URL:latest
docker push $ECR_REPO_URL:latest
```

### 3. Update ECS Service

```bash
aws ecs update-service \
  --cluster $(terraform output -raw ecs_cluster_name) \
  --service streamlit-app-service \
  --force-new-deployment
```

## FIS Chaos Experiments

The deployment includes pre-configured FIS experiment templates:

### Available Experiments

1. **ECS Task Stop** (`catalog-agents-ecs-task-stop`)
   - Stops 50% of ECS tasks to test service resilience
   - Includes CloudWatch alarm stop condition

2. **Network Latency** (template in `fis/experiment-templates.json`)
   - Adds network latency to test application resilience

3. **RDS Failover** (template in `fis/experiment-templates.json`)
   - Tests database failover scenarios

### Running Experiments

1. **Via AWS Console**:
   - Go to AWS FIS console
   - Find experiment templates tagged with `FISTarget=true`
   - Start experiments

2. **Via AWS CLI**:
   ```bash
   # List experiment templates
   aws fis list-experiment-templates --query 'experimentTemplates[?tags.FISTarget==`true`]'
   
   # Start an experiment
   aws fis start-experiment --experiment-template-id <template-id>
   ```

### Monitoring During Experiments

- **CloudWatch**: Monitor ECS service metrics, RDS performance
- **ECS Console**: Watch task health and service events
- **Application**: Test Streamlit UI responsiveness during chaos

## Resource Tagging

All resources are tagged with:
- `Project`: catalog-agents-demo
- `Environment`: dev (configurable)
- `Owner`: catalog-agents-team
- `FISTarget`: true (for chaos experiments)
- `CostCenter`: engineering

## Local Development

Test locally before deploying:

```bash
cd docker
docker-compose up
```

Access:
- Streamlit: http://localhost:8501
- Unity Catalog: http://localhost:8080

## Cleanup

**⚠️ Warning**: This will destroy ALL resources and data.

```bash
./scripts/cleanup.sh
```

## Troubleshooting

### Common Issues

1. **ECR Login Failed**:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ecr-url>
   ```

2. **ECS Service Not Starting**:
   - Check CloudWatch logs: `/ecs/unity-catalog` and `/ecs/streamlit-app`
   - Verify security groups allow traffic on ports 8080 and 8501

3. **Database Connection Issues**:
   - Ensure RDS security group allows connections from ECS tasks
   - Check database credentials in task definition

4. **FIS Experiments Not Working**:
   - Verify IAM role has correct permissions
   - Check resources are tagged with `FISTarget=true`
   - Ensure stop conditions (CloudWatch alarms) are configured

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster <cluster-name> --services <service-name>

# View ECS task logs
aws logs tail /ecs/streamlit-app --follow

# Check RDS status
aws rds describe-db-instances --db-instance-identifier unity-catalog-db

# List FIS experiments
aws fis list-experiments --max-results 10
```

## Security Considerations

- RDS is deployed in private subnets
- Security groups follow least-privilege principles
- Database credentials should be stored in AWS Secrets Manager for production
- ECS tasks run with minimal IAM permissions
- All traffic is HTTP (add HTTPS/TLS for production)

## Cost Optimization

Current configuration uses:
- ECS Fargate: 1.5 vCPU, 3 GB RAM total
- RDS: db.t3.micro (burstable)
- NAT Gateway: Single AZ

For production, consider:
- Multi-AZ RDS deployment
- Auto Scaling for ECS services
- Reserved capacity for predictable workloads
