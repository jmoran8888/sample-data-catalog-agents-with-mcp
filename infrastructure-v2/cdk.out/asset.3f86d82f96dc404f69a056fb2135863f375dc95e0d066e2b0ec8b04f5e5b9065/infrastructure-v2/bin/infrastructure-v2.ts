#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DataStack } from '../lib/data-stack';
import { ComputeStack } from '../lib/compute-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { McpRuntimeStack } from '../lib/mcp-runtime-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// ==============================================
// Stack 1: Network Infrastructure
// ==============================================
const networkStack = new NetworkStack(app, 'CatalogAgentsNetworkStack', {
  env,
  description: 'Network infrastructure for Data Catalog Agents',
  // AgentCore-compatible AZs are auto-detected based on region
  // Can be overridden via context if needed:
  // cdk deploy -c agentCoreAz1=us-east-1a -c agentCoreAz2=us-east-1b -c agentCoreAz3=us-east-1d
});

// ==============================================
// Stack 2: Data Layer (RDS, Glue, S3)
// ==============================================
const dataStack = new DataStack(app, 'CatalogAgentsDataStack', {
  env,
  description: 'Data layer infrastructure (RDS, Glue, S3)',
  networkOutputs: networkStack.outputs,
  databaseName: app.node.tryGetContext('databaseName') || 'unitycatalog',
  databaseUsername: app.node.tryGetContext('databaseUsername') || 'unitycatalog',
});

dataStack.addDependency(networkStack);

// ==============================================
// Stack 3: Compute Layer (ECS, Unity Catalog, Streamlit)
// ==============================================
const computeStack = new ComputeStack(app, 'CatalogAgentsComputeStack', {
  env,
  description: 'Compute layer (ECS, Unity Catalog, Streamlit)',
  networkOutputs: networkStack.outputs,
  dataOutputs: dataStack.outputs,
  unityCatalogImage: app.node.tryGetContext('unityCatalogImage') || 'unitycatalog/unitycatalog:latest',
  streamlitImageTag: app.node.tryGetContext('streamlitImageTag') || 'latest',
});

computeStack.addDependency(dataStack);

// ==============================================
// Stack 4: Frontend Layer (ALB, Cognito)
// ==============================================
const frontendStack = new FrontendStack(app, 'CatalogAgentsFrontendStack', {
  env,
  description: 'Frontend infrastructure (ALB, Cognito)',
  networkOutputs: networkStack.outputs,
  computeOutputs: computeStack.outputs,
  unityCatalogTargetGroup: computeStack.unityCatalogTargetGroup,
  streamlitTargetGroup: computeStack.streamlitTargetGroup,
  adminEmail: app.node.tryGetContext('adminEmail'),
});

frontendStack.addDependency(computeStack);

// ==============================================
// Stack 5: MCP Runtime Layer (AgentCore Runtimes, API Gateway)
// ==============================================
const mcpRuntimeStack = new McpRuntimeStack(app, 'CatalogAgentsMcpRuntimeStack', {
  env,
  description: 'MCP AgentCore Runtimes and API Gateway',
  networkOutputs: networkStack.outputs,
  frontendOutputs: frontendStack.outputs,
});

mcpRuntimeStack.addDependency(frontendStack);

// Add stack-level tags
const stackTags = {
  Project: 'catalog-agents-demo',
  Environment: 'dev',
  ManagedBy: 'CDK',
  Repository: 'sample-data-catalog-agents-with-mcp',
};

Object.entries(stackTags).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value);
});

app.synth();
