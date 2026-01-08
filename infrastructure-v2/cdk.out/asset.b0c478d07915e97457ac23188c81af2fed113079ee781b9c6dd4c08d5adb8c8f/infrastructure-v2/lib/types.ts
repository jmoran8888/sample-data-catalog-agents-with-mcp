/**
 * Shared type definitions for Data Catalog CDK infrastructure
 */
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

/**
 * Props passed between stacks
 */
export interface NetworkStackOutputs {
  vpc: ec2.IVpc;
  publicSubnets: ec2.ISubnet[];
  privateSubnets: ec2.ISubnet[];
  agentCoreCompatibleSubnets: ec2.ISubnet[];
  rdsSecurityGroup: ec2.ISecurityGroup;
  ecsSecurityGroup: ec2.ISecurityGroup;
  albSecurityGroup: ec2.ISecurityGroup;
  mcpSecurityGroup: ec2.ISecurityGroup;
}

export interface DataStackOutputs {
  rdsCluster: rds.IDatabaseCluster;
  rdsSecret: secretsmanager.ISecret;
  rdsSecretArn: string;
  glueDatabaseNames: string[];
  glueDataBucketName: string;
}

export interface ComputeStackOutputs {
  ecsClusterName: string;
  streamlitEcrRepositoryUri: string;
  unityCatalogServiceName: string;
  streamlitServiceName: string;
}

export interface FrontendStackOutputs {
  albDnsName: string;
  albArn: string;
  cognitoUserPoolId: string;
  cognitoUserPoolArn: string;
  apiEndpoint: string;
}

export interface McpRuntimeStackOutputs {
  unityMcpRuntimeArn: string;
  glueMcpRuntimeArn: string;
  mcpApiUrl: string;
}
