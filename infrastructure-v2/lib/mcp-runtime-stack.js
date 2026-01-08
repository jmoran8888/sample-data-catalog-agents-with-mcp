"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpRuntimeStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const agentcore = __importStar(require("@aws-cdk/aws-bedrock-agentcore-alpha"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const path = __importStar(require("path"));
class McpRuntimeStack extends cdk.Stack {
    outputs;
    constructor(scope, id, props) {
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
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'UnityCloudWatchPolicy', 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess'),
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
            agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(path.join(__dirname, '../..'), // Project root
            {
                file: 'mcp/unity-catalog-server/Dockerfile',
                exclude: ['infrastructure-v2', 'infrastructure', 'deploy/terraform/.terraform', '.git', 'reference', '.kiro'],
            }),
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
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'GlueCloudWatchPolicy', 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess'),
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
            agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(path.join(__dirname, '../..'), // Project root
            {
                file: 'mcp/glue-catalog-server/Dockerfile',
                exclude: ['infrastructure-v2', 'infrastructure', 'deploy/terraform/.terraform', '.git', 'reference', '.kiro'],
            }),
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
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'UnityProxyLambdaBasicExecution', 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'),
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
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'GlueProxyLambdaBasicExecution', 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'),
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
        const methodOptions = {
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
exports.McpRuntimeStack = McpRuntimeStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXJ1bnRpbWUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtY3AtcnVudGltZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsZ0ZBQWtFO0FBQ2xFLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLHVFQUF5RDtBQUN6RCwyQ0FBNkI7QUFRN0IsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVCLE9BQU8sQ0FBeUI7SUFFaEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUVsRCxpREFBaUQ7UUFDakQsNEJBQTRCO1FBQzVCLGlEQUFpRDtRQUVqRCxpQ0FBaUM7UUFDakMsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ3BFLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxpQ0FBaUMsQ0FBQztZQUN0RSxRQUFRLEVBQUUsd0JBQXdCO1lBQ2xDLGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLG9CQUFvQixDQUNwQyxJQUFJLEVBQ0osdUJBQXVCLEVBQ3ZCLGtEQUFrRCxDQUNuRDthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsaUNBQWlDO1FBQ2pDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEQsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1AscUJBQXFCO2dCQUNyQix1Q0FBdUM7YUFD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UUFFSCxXQUFXO1FBQ1gsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO1FBQ3hELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDNUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM1QyxDQUFDO0NBQ0Y7QUEzU0QsMENBMlNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgYWdlbnRjb3JlIGZyb20gJ0Bhd3MtY2RrL2F3cy1iZWRyb2NrLWFnZW50Y29yZS1hbHBoYSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE5ldHdvcmtTdGFja091dHB1dHMsIEZyb250ZW5kU3RhY2tPdXRwdXRzLCBNY3BSdW50aW1lU3RhY2tPdXRwdXRzIH0gZnJvbSAnLi90eXBlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWNwUnVudGltZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIG5ldHdvcmtPdXRwdXRzOiBOZXR3b3JrU3RhY2tPdXRwdXRzO1xuICBmcm9udGVuZE91dHB1dHM6IEZyb250ZW5kU3RhY2tPdXRwdXRzO1xufVxuXG5leHBvcnQgY2xhc3MgTWNwUnVudGltZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IG91dHB1dHM6IE1jcFJ1bnRpbWVTdGFja091dHB1dHM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE1jcFJ1bnRpbWVTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IG5ldHdvcmtPdXRwdXRzLCBmcm9udGVuZE91dHB1dHMgfSA9IHByb3BzO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFVuaXR5IENhdGFsb2cgTUNQIFJ1bnRpbWVcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBJQU0gUm9sZSBmb3IgVW5pdHkgTUNQIFJ1bnRpbWVcbiAgICBjb25zdCB1bml0eU1jcFJ1bnRpbWVSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdVbml0eU1jcFJ1bnRpbWVSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2stYWdlbnRjb3JlLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHJvbGVOYW1lOiAndW5pdHktbWNwLXJ1bnRpbWUtcm9sZScsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbU1hbmFnZWRQb2xpY3lBcm4oXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICAnVW5pdHlDbG91ZFdhdGNoUG9saWN5JyxcbiAgICAgICAgICAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvQ2xvdWRXYXRjaExvZ3NGdWxsQWNjZXNzJ1xuICAgICAgICApLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IEJlZHJvY2sgbW9kZWwgaW52b2NhdGlvblxuICAgIHVuaXR5TWNwUnVudGltZVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLypgLFxuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fToqYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gR3JhbnQgYWNjZXNzIHRvIGludm9rZSBVbml0eSBDYXRhbG9nIHZpYSBIVFRQXG4gICAgdW5pdHlNY3BSdW50aW1lUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdleGVjdXRlLWFwaTpJbnZva2UnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gQ3JlYXRlIFVuaXR5IE1DUCBSdW50aW1lXG4gICAgY29uc3QgdW5pdHlNY3BSdW50aW1lID0gbmV3IGFnZW50Y29yZS5SdW50aW1lKHRoaXMsICdVbml0eU1jcFJ1bnRpbWUnLCB7XG4gICAgICBydW50aW1lTmFtZTogJ3VuaXR5X2NhdGFsb2dfbWNwJyxcbiAgICAgIGFnZW50UnVudGltZUFydGlmYWN0OiBhZ2VudGNvcmUuQWdlbnRSdW50aW1lQXJ0aWZhY3QuZnJvbUFzc2V0KFxuICAgICAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4nKSwgLy8gUHJvamVjdCByb290XG4gICAgICAgIHtcbiAgICAgICAgICBmaWxlOiAnbWNwL3VuaXR5LWNhdGFsb2ctc2VydmVyL0RvY2tlcmZpbGUnLFxuICAgICAgICAgIGV4Y2x1ZGU6IFsnaW5mcmFzdHJ1Y3R1cmUtdjInLCAnaW5mcmFzdHJ1Y3R1cmUnLCAnZGVwbG95L3RlcnJhZm9ybS8udGVycmFmb3JtJywgJy5naXQnLCAncmVmZXJlbmNlJywgJy5raXJvJ10sXG4gICAgICAgIH1cbiAgICAgICksXG4gICAgICBuZXR3b3JrQ29uZmlndXJhdGlvbjogYWdlbnRjb3JlLlJ1bnRpbWVOZXR3b3JrQ29uZmlndXJhdGlvbi51c2luZ1ZwYyh0aGlzLCB7XG4gICAgICAgIHZwYzogbmV0d29ya091dHB1dHMudnBjLFxuICAgICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldHM6IG5ldHdvcmtPdXRwdXRzLmFnZW50Q29yZUNvbXBhdGlibGVTdWJuZXRzIH0sXG4gICAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbmV0d29ya091dHB1dHMubWNwU2VjdXJpdHlHcm91cF0sXG4gICAgICB9KSxcbiAgICAgIGV4ZWN1dGlvblJvbGU6IHVuaXR5TWNwUnVudGltZVJvbGUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VuaXR5IENhdGFsb2cgTUNQIFNlcnZlciBvbiBBZ2VudENvcmUgUnVudGltZScsXG4gICAgICBlbnZpcm9ubWVudFZhcmlhYmxlczoge1xuICAgICAgICBVTklUWV9DQVRBTE9HX1VSTDogZnJvbnRlbmRPdXRwdXRzLmFwaUVuZHBvaW50ICsgJy9hcGkvMi4xL3VuaXR5LWNhdGFsb2cnLFxuICAgICAgICBBV1NfUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gR2x1ZSBDYXRhbG9nIE1DUCBSdW50aW1lXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gSUFNIFJvbGUgZm9yIEdsdWUgTUNQIFJ1bnRpbWVcbiAgICBjb25zdCBnbHVlTWNwUnVudGltZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0dsdWVNY3BSdW50aW1lUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLWFnZW50Y29yZS5hbWF6b25hd3MuY29tJyksXG4gICAgICByb2xlTmFtZTogJ2dsdWUtbWNwLXJ1bnRpbWUtcm9sZScsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbU1hbmFnZWRQb2xpY3lBcm4oXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICAnR2x1ZUNsb3VkV2F0Y2hQb2xpY3knLFxuICAgICAgICAgICdhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9DbG91ZFdhdGNoTG9nc0Z1bGxBY2Nlc3MnXG4gICAgICAgICksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgQmVkcm9jayBtb2RlbCBpbnZvY2F0aW9uXG4gICAgZ2x1ZU1jcFJ1bnRpbWVSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC8qYCxcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06KmAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIEdyYW50IEdsdWUgcGVybWlzc2lvbnNcbiAgICBnbHVlTWNwUnVudGltZVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZ2x1ZTpHZXREYXRhYmFzZScsXG4gICAgICAgICdnbHVlOkdldERhdGFiYXNlcycsXG4gICAgICAgICdnbHVlOkdldFRhYmxlJyxcbiAgICAgICAgJ2dsdWU6R2V0VGFibGVzJyxcbiAgICAgICAgJ2dsdWU6R2V0UGFydGl0aW9uJyxcbiAgICAgICAgJ2dsdWU6R2V0UGFydGl0aW9ucycsXG4gICAgICAgICdnbHVlOlNlYXJjaFRhYmxlcycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBDcmVhdGUgR2x1ZSBNQ1AgUnVudGltZVxuICAgIGNvbnN0IGdsdWVNY3BSdW50aW1lID0gbmV3IGFnZW50Y29yZS5SdW50aW1lKHRoaXMsICdHbHVlTWNwUnVudGltZScsIHtcbiAgICAgIHJ1bnRpbWVOYW1lOiAnZ2x1ZV9jYXRhbG9nX21jcCcsXG4gICAgICBhZ2VudFJ1bnRpbWVBcnRpZmFjdDogYWdlbnRjb3JlLkFnZW50UnVudGltZUFydGlmYWN0LmZyb21Bc3NldChcbiAgICAgICAgcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uJyksIC8vIFByb2plY3Qgcm9vdFxuICAgICAgICB7XG4gICAgICAgICAgZmlsZTogJ21jcC9nbHVlLWNhdGFsb2ctc2VydmVyL0RvY2tlcmZpbGUnLFxuICAgICAgICAgIGV4Y2x1ZGU6IFsnaW5mcmFzdHJ1Y3R1cmUtdjInLCAnaW5mcmFzdHJ1Y3R1cmUnLCAnZGVwbG95L3RlcnJhZm9ybS8udGVycmFmb3JtJywgJy5naXQnLCAncmVmZXJlbmNlJywgJy5raXJvJ10sXG4gICAgICAgIH1cbiAgICAgICksXG4gICAgICBuZXR3b3JrQ29uZmlndXJhdGlvbjogYWdlbnRjb3JlLlJ1bnRpbWVOZXR3b3JrQ29uZmlndXJhdGlvbi51c2luZ1ZwYyh0aGlzLCB7XG4gICAgICAgIHZwYzogbmV0d29ya091dHB1dHMudnBjLFxuICAgICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldHM6IG5ldHdvcmtPdXRwdXRzLmFnZW50Q29yZUNvbXBhdGlibGVTdWJuZXRzIH0sXG4gICAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbmV0d29ya091dHB1dHMubWNwU2VjdXJpdHlHcm91cF0sXG4gICAgICB9KSxcbiAgICAgIGV4ZWN1dGlvblJvbGU6IGdsdWVNY3BSdW50aW1lUm9sZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2x1ZSBDYXRhbG9nIE1DUCBTZXJ2ZXIgb24gQWdlbnRDb3JlIFJ1bnRpbWUnLFxuICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgQVdTX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIExhbWJkYSBQcm94eSBGdW5jdGlvbnNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBVbml0eSBNQ1AgUHJveHkgTGFtYmRhXG4gICAgY29uc3QgdW5pdHlNY3BQcm94eVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1VuaXR5TWNwUHJveHlSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbU1hbmFnZWRQb2xpY3lBcm4oXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICAnVW5pdHlQcm94eUxhbWJkYUJhc2ljRXhlY3V0aW9uJyxcbiAgICAgICAgICAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZSdcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB1bml0eU1jcFByb3h5TGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVW5pdHlNY3BQcm94eScsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzEyLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmxhbWJkYV9oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL21jcC1wcm94eScpKSxcbiAgICAgIHJvbGU6IHVuaXR5TWNwUHJveHlSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUlVOVElNRV9BUk46IHVuaXR5TWNwUnVudGltZS5hZ2VudFJ1bnRpbWVBcm4sXG4gICAgICB9LFxuICAgICAgbG9nR3JvdXA6IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdVbml0eU1jcFByb3h5TG9nR3JvdXAnLCB7XG4gICAgICAgIGxvZ0dyb3VwTmFtZTogJy9hd3MvbGFtYmRhL3VuaXR5LW1jcC1wcm94eScsXG4gICAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLlRXT19XRUVLUyxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbiB0byBpbnZva2UgVW5pdHkgTUNQIFJ1bnRpbWVcbiAgICB1bml0eU1jcFByb3h5TGFtYmRhLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbJ2JlZHJvY2stYWdlbnRjb3JlOkludm9rZUFnZW50UnVudGltZSddLFxuICAgICAgcmVzb3VyY2VzOiBbYCR7dW5pdHlNY3BSdW50aW1lLmFnZW50UnVudGltZUFybn0qYF0sXG4gICAgfSkpO1xuXG4gICAgLy8gR2x1ZSBNQ1AgUHJveHkgTGFtYmRhXG4gICAgY29uc3QgZ2x1ZU1jcFByb3h5Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnR2x1ZU1jcFByb3h5Um9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21NYW5hZ2VkUG9saWN5QXJuKFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgJ0dsdWVQcm94eUxhbWJkYUJhc2ljRXhlY3V0aW9uJyxcbiAgICAgICAgICAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZSdcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBnbHVlTWNwUHJveHlMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHbHVlTWNwUHJveHknLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5sYW1iZGFfaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYS9tY3AtcHJveHknKSksXG4gICAgICByb2xlOiBnbHVlTWNwUHJveHlSb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUlVOVElNRV9BUk46IGdsdWVNY3BSdW50aW1lLmFnZW50UnVudGltZUFybixcbiAgICAgIH0sXG4gICAgICBsb2dHcm91cDogbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0dsdWVNY3BQcm94eUxvZ0dyb3VwJywge1xuICAgICAgICBsb2dHcm91cE5hbWU6ICcvYXdzL2xhbWJkYS9nbHVlLW1jcC1wcm94eScsXG4gICAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLlRXT19XRUVLUyxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbiB0byBpbnZva2UgR2x1ZSBNQ1AgUnVudGltZVxuICAgIGdsdWVNY3BQcm94eUxhbWJkYS5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydiZWRyb2NrLWFnZW50Y29yZTpJbnZva2VBZ2VudFJ1bnRpbWUnXSxcbiAgICAgIHJlc291cmNlczogW2Ake2dsdWVNY3BSdW50aW1lLmFnZW50UnVudGltZUFybn0qYF0sXG4gICAgfSkpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnTWNwQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6ICdEYXRhIENhdGFsb2cgTUNQIEFQSScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IGZvciBNQ1AgQWdlbnRDb3JlIFJ1bnRpbWVzJyxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnWC1BbXotRGF0ZScsICdBdXRob3JpemF0aW9uJywgJ1gtQXBpLUtleSddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIElBTSBhdXRob3JpemF0aW9uIGZvciBhbGwgbWV0aG9kc1xuICAgIGNvbnN0IG1ldGhvZE9wdGlvbnM6IGFwaWdhdGV3YXkuTWV0aG9kT3B0aW9ucyA9IHtcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLklBTSxcbiAgICB9O1xuXG4gICAgLy8gVW5pdHkgTUNQIGVuZHBvaW50c1xuICAgIGNvbnN0IHVuaXR5ID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3VuaXR5Jyk7XG4gICAgY29uc3QgdW5pdHlEYXRhYmFzZXMgPSB1bml0eS5hZGRSZXNvdXJjZSgnZGF0YWJhc2VzJyk7XG4gICAgdW5pdHlEYXRhYmFzZXMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1bml0eU1jcFByb3h5TGFtYmRhKSwgbWV0aG9kT3B0aW9ucyk7XG5cbiAgICBjb25zdCB1bml0eVRhYmxlcyA9IHVuaXR5LmFkZFJlc291cmNlKCd0YWJsZXMnKTtcbiAgICBjb25zdCB1bml0eVRhYmxlc0RiID0gdW5pdHlUYWJsZXMuYWRkUmVzb3VyY2UoJ3tkYXRhYmFzZX0nKTtcbiAgICB1bml0eVRhYmxlc0RiLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odW5pdHlNY3BQcm94eUxhbWJkYSksIG1ldGhvZE9wdGlvbnMpO1xuXG4gICAgY29uc3QgdW5pdHlUYWJsZURldGFpbHMgPSB1bml0eVRhYmxlc0RiLmFkZFJlc291cmNlKCd7dGFibGV9Jyk7XG4gICAgdW5pdHlUYWJsZURldGFpbHMuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih1bml0eU1jcFByb3h5TGFtYmRhKSwgbWV0aG9kT3B0aW9ucyk7XG5cbiAgICAvLyBHbHVlIE1DUCBlbmRwb2ludHNcbiAgICBjb25zdCBnbHVlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2dsdWUnKTtcbiAgICBjb25zdCBnbHVlRGF0YWJhc2VzID0gZ2x1ZS5hZGRSZXNvdXJjZSgnZGF0YWJhc2VzJyk7XG4gICAgZ2x1ZURhdGFiYXNlcy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdsdWVNY3BQcm94eUxhbWJkYSksIG1ldGhvZE9wdGlvbnMpO1xuXG4gICAgY29uc3QgZ2x1ZVRhYmxlcyA9IGdsdWUuYWRkUmVzb3VyY2UoJ3RhYmxlcycpO1xuICAgIGNvbnN0IGdsdWVUYWJsZXNEYiA9IGdsdWVUYWJsZXMuYWRkUmVzb3VyY2UoJ3tkYXRhYmFzZX0nKTtcbiAgICBnbHVlVGFibGVzRGIuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnbHVlTWNwUHJveHlMYW1iZGEpLCBtZXRob2RPcHRpb25zKTtcblxuICAgIGNvbnN0IGdsdWVUYWJsZURldGFpbHMgPSBnbHVlVGFibGVzRGIuYWRkUmVzb3VyY2UoJ3t0YWJsZX0nKTtcbiAgICBnbHVlVGFibGVEZXRhaWxzLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2x1ZU1jcFByb3h5TGFtYmRhKSwgbWV0aG9kT3B0aW9ucyk7XG5cbiAgICAvLyBTdG9yZSBvdXRwdXRzXG4gICAgdGhpcy5vdXRwdXRzID0ge1xuICAgICAgdW5pdHlNY3BSdW50aW1lQXJuOiB1bml0eU1jcFJ1bnRpbWUuYWdlbnRSdW50aW1lQXJuLFxuICAgICAgZ2x1ZU1jcFJ1bnRpbWVBcm46IGdsdWVNY3BSdW50aW1lLmFnZW50UnVudGltZUFybixcbiAgICAgIG1jcEFwaVVybDogYXBpLnVybCxcbiAgICB9O1xuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVbml0eU1jcFJ1bnRpbWVBcm4nLCB7XG4gICAgICB2YWx1ZTogdW5pdHlNY3BSdW50aW1lLmFnZW50UnVudGltZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnVW5pdHkgQ2F0YWxvZyBNQ1AgUnVudGltZSBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVuaXR5TWNwUnVudGltZUFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR2x1ZU1jcFJ1bnRpbWVBcm4nLCB7XG4gICAgICB2YWx1ZTogZ2x1ZU1jcFJ1bnRpbWUuYWdlbnRSdW50aW1lQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdHbHVlIENhdGFsb2cgTUNQIFJ1bnRpbWUgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1HbHVlTWNwUnVudGltZUFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTWNwQXBpVXJsJywge1xuICAgICAgdmFsdWU6IGFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ01DUCBBUEkgR2F0ZXdheSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LU1jcEFwaVVybGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVW5pdHlNY3BFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiBgJHthcGkudXJsfXVuaXR5L2RhdGFiYXNlc2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VuaXR5IE1DUCBEYXRhYmFzZXMgRW5kcG9pbnQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVuaXR5TWNwRW5kcG9pbnRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0dsdWVNY3BFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiBgJHthcGkudXJsfWdsdWUvZGF0YWJhc2VzYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2x1ZSBNQ1AgRGF0YWJhc2VzIEVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1HbHVlTWNwRW5kcG9pbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHRhZ3NcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnY2F0YWxvZy1hZ2VudHMtZGVtbycpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCAnZGV2Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gIH1cbn1cbiJdfQ==