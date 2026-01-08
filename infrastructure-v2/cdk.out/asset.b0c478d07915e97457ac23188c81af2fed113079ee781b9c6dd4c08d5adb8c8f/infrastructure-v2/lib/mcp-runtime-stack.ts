import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { NetworkStackOutputs, FrontendStackOutputs, McpRuntimeStackOutputs } from './types';

export interface McpRuntimeStackProps extends cdk.StackProps {
  networkOutputs: NetworkStackOutputs;
  frontendOutputs: FrontendStackOutputs;
}

export class McpRuntimeStack extends cdk.Stack {
  public readonly outputs: McpRuntimeStackOutputs;

  constructor(scope: Construct, id: string, props: McpRuntimeStackProps) {
    super(scope, id, props);

    const { networkOutputs, frontendOutputs } = props;

    // ==============================================
    // Unity Catalog MCP Runtime
    // ==============================================

    // IAM Role for Unity MCP Runtime
    const unityMcpRuntimeRole = new iam.Role(this, 'UnityMcpRuntimeRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      roleName: 'unity-mcp-runtime-role',
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(
          this,
          'UnityCloudWatchPolicy',
          'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess'
        ),
      ],
    });

    // Grant Bedrock model invocation
    unityMcpRuntimeRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:*::foundation-model/*`,
        `arn:aws:bedrock:${this.region}:${this.account}:*`,
      ],
    }));

    // Grant access to invoke Unity Catalog via HTTP
    unityMcpRuntimeRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'execute-api:Invoke',
      ],
      resources: ['*'],
    }));

    // Create Unity MCP Runtime
    const unityMcpRuntime = new agentcore.Runtime(this, 'UnityMcpRuntime', {
      runtimeName: 'unity_catalog_mcp',
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
        path.join(__dirname, '../..'), // Project root
        {
          file: 'mcp/unity-catalog-server/Dockerfile',
          exclude: ['infrastructure-v2', 'infrastructure', 'deploy/terraform/.terraform', '.git', 'reference', '.kiro'],
        }
      ),
      networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingVpc(this, {
        vpc: networkOutputs.vpc,
        vpcSubnets: { subnets: networkOutputs.agentCoreCompatibleSubnets },
        securityGroups: [networkOutputs.mcpSecurityGroup],
      }),
      executionRole: unityMcpRuntimeRole,
      description: 'Unity Catalog MCP Server on AgentCore Runtime',
      environmentVariables: {
        UNITY_CATALOG_URL: frontendOutputs.apiEndpoint + '/api/2.1/unity-catalog',
        AWS_REGION: this.region,
      },
    });

    // ==============================================
    // Glue Catalog MCP Runtime
    // ==============================================

    // IAM Role for Glue MCP Runtime
    const glueMcpRuntimeRole = new iam.Role(this, 'GlueMcpRuntimeRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      roleName: 'glue-mcp-runtime-role',
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(
          this,
          'GlueCloudWatchPolicy',
          'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess'
        ),
      ],
    });

    // Grant Bedrock model invocation
    glueMcpRuntimeRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:*::foundation-model/*`,
        `arn:aws:bedrock:${this.region}:${this.account}:*`,
      ],
    }));

    // Grant Glue permissions
    glueMcpRuntimeRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'glue:GetDatabase',
        'glue:GetDatabases',
        'glue:GetTable',
        'glue:GetTables',
        'glue:GetPartition',
        'glue:GetPartitions',
        'glue:SearchTables',
      ],
      resources: ['*'],
    }));

    // Create Glue MCP Runtime
    const glueMcpRuntime = new agentcore.Runtime(this, 'GlueMcpRuntime', {
      runtimeName: 'glue_catalog_mcp',
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
        path.join(__dirname, '../..'), // Project root
        {
          file: 'mcp/glue-catalog-server/Dockerfile',
          exclude: ['infrastructure-v2', 'infrastructure', 'deploy/terraform/.terraform', '.git', 'reference', '.kiro'],
        }
      ),
      networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingVpc(this, {
        vpc: networkOutputs.vpc,
        vpcSubnets: { subnets: networkOutputs.agentCoreCompatibleSubnets },
        securityGroups: [networkOutputs.mcpSecurityGroup],
      }),
      executionRole: glueMcpRuntimeRole,
      description: 'Glue Catalog MCP Server on AgentCore Runtime',
      environmentVariables: {
        AWS_REGION: this.region,
      },
    });

    // ==============================================
    // Lambda Proxy Functions
    // ==============================================

    // Unity MCP Proxy Lambda
    const unityMcpProxyRole = new iam.Role(this, 'UnityMcpProxyRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(
          this,
          'UnityProxyLambdaBasicExecution',
          'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    const unityMcpProxyLambda = new lambda.Function(this, 'UnityMcpProxy', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/mcp-proxy')),
      role: unityMcpProxyRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      environment: {
        RUNTIME_ARN: unityMcpRuntime.agentRuntimeArn,
      },
      logGroup: new logs.LogGroup(this, 'UnityMcpProxyLogGroup', {
        logGroupName: '/aws/lambda/unity-mcp-proxy',
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    // Grant permission to invoke Unity MCP Runtime
    unityMcpProxyLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock-agentcore:InvokeAgentRuntime'],
      resources: [`${unityMcpRuntime.agentRuntimeArn}*`],
    }));

    // Glue MCP Proxy Lambda
    const glueMcpProxyRole = new iam.Role(this, 'GlueMcpProxyRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(
          this,
          'GlueProxyLambdaBasicExecution',
          'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    const glueMcpProxyLambda = new lambda.Function(this, 'GlueMcpProxy', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/mcp-proxy')),
      role: glueMcpProxyRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      environment: {
        RUNTIME_ARN: glueMcpRuntime.agentRuntimeArn,
      },
      logGroup: new logs.LogGroup(this, 'GlueMcpProxyLogGroup', {
        logGroupName: '/aws/lambda/glue-mcp-proxy',
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    // Grant permission to invoke Glue MCP Runtime
    glueMcpProxyLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock-agentcore:InvokeAgentRuntime'],
      resources: [`${glueMcpRuntime.agentRuntimeArn}*`],
    }));

    // ==============================================
    // API Gateway
    // ==============================================

    const api = new apigateway.RestApi(this, 'McpApi', {
      restApiName: 'Data Catalog MCP API',
      description: 'API Gateway for MCP AgentCore Runtimes',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // IAM authorization for all methods
    const methodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.IAM,
    };

    // Unity MCP endpoints
    const unity = api.root.addResource('unity');
    const unityDatabases = unity.addResource('databases');
    unityDatabases.addMethod('GET', new apigateway.LambdaIntegration(unityMcpProxyLambda), methodOptions);

    const unityTables = unity.addResource('tables');
    const unityTablesDb = unityTables.addResource('{database}');
    unityTablesDb.addMethod('GET', new apigateway.LambdaIntegration(unityMcpProxyLambda), methodOptions);

    const unityTableDetails = unityTablesDb.addResource('{table}');
    unityTableDetails.addMethod('GET', new apigateway.LambdaIntegration(unityMcpProxyLambda), methodOptions);

    // Glue MCP endpoints
    const glue = api.root.addResource('glue');
    const glueDatabases = glue.addResource('databases');
    glueDatabases.addMethod('GET', new apigateway.LambdaIntegration(glueMcpProxyLambda), methodOptions);

    const glueTables = glue.addResource('tables');
    const glueTablesDb = glueTables.addResource('{database}');
    glueTablesDb.addMethod('GET', new apigateway.LambdaIntegration(glueMcpProxyLambda), methodOptions);

    const glueTableDetails = glueTablesDb.addResource('{table}');
    glueTableDetails.addMethod('GET', new apigateway.LambdaIntegration(glueMcpProxyLambda), methodOptions);

    // Store outputs
    this.outputs = {
      unityMcpRuntimeArn: unityMcpRuntime.agentRuntimeArn,
      glueMcpRuntimeArn: glueMcpRuntime.agentRuntimeArn,
      mcpApiUrl: api.url,
    };

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'UnityMcpRuntimeArn', {
      value: unityMcpRuntime.agentRuntimeArn,
      description: 'Unity Catalog MCP Runtime ARN',
      exportName: `${this.stackName}-UnityMcpRuntimeArn`,
    });

    new cdk.CfnOutput(this, 'GlueMcpRuntimeArn', {
      value: glueMcpRuntime.agentRuntimeArn,
      description: 'Glue Catalog MCP Runtime ARN',
      exportName: `${this.stackName}-GlueMcpRuntimeArn`,
    });

    new cdk.CfnOutput(this, 'McpApiUrl', {
      value: api.url,
      description: 'MCP API Gateway URL',
      exportName: `${this.stackName}-McpApiUrl`,
    });

    new cdk.CfnOutput(this, 'UnityMcpEndpoint', {
      value: `${api.url}unity/databases`,
      description: 'Unity MCP Databases Endpoint',
      exportName: `${this.stackName}-UnityMcpEndpoint`,
    });

    new cdk.CfnOutput(this, 'GlueMcpEndpoint', {
      value: `${api.url}glue/databases`,
      description: 'Glue MCP Databases Endpoint',
      exportName: `${this.stackName}-GlueMcpEndpoint`,
    });

    // Add tags
    cdk.Tags.of(this).add('Project', 'catalog-agents-demo');
    cdk.Tags.of(this).add('Environment', 'dev');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
