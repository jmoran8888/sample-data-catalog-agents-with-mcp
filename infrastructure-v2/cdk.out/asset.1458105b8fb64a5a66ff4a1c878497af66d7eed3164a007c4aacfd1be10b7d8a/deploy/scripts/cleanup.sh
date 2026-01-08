#!/bin/bash

set -e

echo "🧹 Starting cleanup of Catalog Agents Demo resources"

# Navigate to terraform directory
cd "$(dirname "$0")/../terraform"

# Check if terraform state exists
if [ ! -f "terraform.tfstate" ]; then
    echo "❌ No Terraform state found. Nothing to clean up."
    exit 0
fi

# Get ECR repository URL before destroying
ECR_REPO_URL=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "")

if [ ! -z "$ECR_REPO_URL" ]; then
    echo "🐳 Cleaning up ECR images..."
    aws ecr list-images --repository-name catalog-agents/streamlit-app --query 'imageIds[*]' --output json | \
    jq '.[] | select(.imageTag != null) | {imageDigest: .imageDigest}' | \
    jq -s '.' > /tmp/images-to-delete.json
    
    if [ -s /tmp/images-to-delete.json ] && [ "$(cat /tmp/images-to-delete.json)" != "[]" ]; then
        aws ecr batch-delete-image --repository-name catalog-agents/streamlit-app --image-ids file:///tmp/images-to-delete.json
        echo "✅ ECR images cleaned up"
    fi
fi

# Destroy infrastructure
echo "💥 Destroying Terraform infrastructure..."
terraform destroy -auto-approve

echo "✅ Cleanup completed successfully!"
echo "All AWS resources have been destroyed."
