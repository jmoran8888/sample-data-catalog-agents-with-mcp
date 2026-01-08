#!/usr/bin/env node
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
const cdk = __importStar(require("aws-cdk-lib"));
const network_stack_1 = require("../lib/network-stack");
const data_stack_1 = require("../lib/data-stack");
const compute_stack_1 = require("../lib/compute-stack");
const mcp_runtime_stack_1 = require("../lib/mcp-runtime-stack");
const app = new cdk.App();
// Environment configuration
// Explicitly check multiple environment variables for region
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
console.log(`🌍 Deploying to region: ${region}`);
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: region,
};
// ==============================================
// Stack 1: Network Infrastructure
// ==============================================
const networkStack = new network_stack_1.NetworkStack(app, 'CatalogAgentsNetworkStack', {
    env,
    description: 'Network infrastructure for Data Catalog Agents',
    // AgentCore-compatible AZs are auto-detected based on region
    // Can be overridden via context if needed:
    // cdk deploy -c agentCoreAz1=us-east-1a -c agentCoreAz2=us-east-1b -c agentCoreAz3=us-east-1d
});
// ==============================================
// Stack 2: Data Layer (RDS, Glue, S3)
// ==============================================
const dataStack = new data_stack_1.DataStack(app, 'CatalogAgentsDataStack', {
    env,
    description: 'Data layer infrastructure (RDS, Glue, S3)',
    networkOutputs: networkStack.outputs,
    databaseName: app.node.tryGetContext('databaseName') || 'unitycatalog',
    databaseUsername: app.node.tryGetContext('databaseUsername') || 'unitycatalog',
});
dataStack.addDependency(networkStack);
// ==============================================
// Stack 3: Compute Layer (ECS, Unity Catalog, Streamlit, ALB, Cognito)
// ==============================================
const computeStack = new compute_stack_1.ComputeStack(app, 'CatalogAgentsComputeStack', {
    env,
    description: 'Compute layer (ECS, Unity Catalog, Streamlit, ALB with Cognito)',
    networkOutputs: networkStack.outputs,
    dataOutputs: dataStack.outputs,
    unityCatalogImage: app.node.tryGetContext('unityCatalogImage') || 'unitycatalog/unitycatalog:latest',
    streamlitImageTag: app.node.tryGetContext('streamlitImageTag') || 'latest',
    adminEmail: app.node.tryGetContext('adminEmail'),
});
computeStack.addDependency(dataStack);
// ==============================================
// Stack 4: MCP Runtime Layer (AgentCore Runtimes, API Gateway)
// ==============================================
// Note: FrontendStack removed - Cognito now integrated in ComputeStack
const mcpRuntimeStack = new mcp_runtime_stack_1.McpRuntimeStack(app, 'CatalogAgentsMcpRuntimeStack', {
    env,
    description: 'MCP AgentCore Runtimes and API Gateway',
    networkOutputs: networkStack.outputs,
    frontendOutputs: {
        albDnsName: computeStack.alb.loadBalancerDnsName,
        albArn: computeStack.alb.loadBalancerArn,
        cognitoUserPoolId: '', // Not needed for MCP stack
        cognitoUserPoolArn: '',
        apiEndpoint: `http://${computeStack.alb.loadBalancerDnsName}`,
    },
});
mcpRuntimeStack.addDependency(computeStack);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mcmFzdHJ1Y3R1cmUtdjIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmZyYXN0cnVjdHVyZS12Mi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSxpREFBbUM7QUFDbkMsd0RBQW9EO0FBQ3BELGtEQUE4QztBQUM5Qyx3REFBb0Q7QUFFcEQsZ0VBQTJEO0FBRTNELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLDRCQUE0QjtBQUM1Qiw2REFBNkQ7QUFDN0QsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVcsQ0FBQztBQUV6SCxPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBRWpELE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO0lBQ3hDLE1BQU0sRUFBRSxNQUFNO0NBQ2YsQ0FBQztBQUVGLGlEQUFpRDtBQUNqRCxrQ0FBa0M7QUFDbEMsaURBQWlEO0FBQ2pELE1BQU0sWUFBWSxHQUFHLElBQUksNEJBQVksQ0FBQyxHQUFHLEVBQUUsMkJBQTJCLEVBQUU7SUFDdEUsR0FBRztJQUNILFdBQVcsRUFBRSxnREFBZ0Q7SUFDN0QsNkRBQTZEO0lBQzdELDJDQUEyQztJQUMzQyw4RkFBOEY7Q0FDL0YsQ0FBQyxDQUFDO0FBRUgsaURBQWlEO0FBQ2pELHNDQUFzQztBQUN0QyxpREFBaUQ7QUFDakQsTUFBTSxTQUFTLEdBQUcsSUFBSSxzQkFBUyxDQUFDLEdBQUcsRUFBRSx3QkFBd0IsRUFBRTtJQUM3RCxHQUFHO0lBQ0gsV0FBVyxFQUFFLDJDQUEyQztJQUN4RCxjQUFjLEVBQUUsWUFBWSxDQUFDLE9BQU87SUFDcEMsWUFBWSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLGNBQWM7SUFDdEUsZ0JBQWdCLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsa0JBQWtCLENBQUMsSUFBSSxjQUFjO0NBQy9FLENBQUMsQ0FBQztBQUVILFNBQVMsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFdEMsaURBQWlEO0FBQ2pELHVFQUF1RTtBQUN2RSxpREFBaUQ7QUFDakQsTUFBTSxZQUFZLEdBQUcsSUFBSSw0QkFBWSxDQUFDLEdBQUcsRUFBRSwyQkFBMkIsRUFBRTtJQUN0RSxHQUFHO0lBQ0gsV0FBVyxFQUFFLGlFQUFpRTtJQUM5RSxjQUFjLEVBQUUsWUFBWSxDQUFDLE9BQU87SUFDcEMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxPQUFPO0lBQzlCLGlCQUFpQixFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQixDQUFDLElBQUksa0NBQWtDO0lBQ3BHLGlCQUFpQixFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQixDQUFDLElBQUksUUFBUTtJQUMxRSxVQUFVLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDO0NBQ2pELENBQUMsQ0FBQztBQUVILFlBQVksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7QUFFdEMsaURBQWlEO0FBQ2pELCtEQUErRDtBQUMvRCxpREFBaUQ7QUFDakQsdUVBQXVFO0FBQ3ZFLE1BQU0sZUFBZSxHQUFHLElBQUksbUNBQWUsQ0FBQyxHQUFHLEVBQUUsOEJBQThCLEVBQUU7SUFDL0UsR0FBRztJQUNILFdBQVcsRUFBRSx3Q0FBd0M7SUFDckQsY0FBYyxFQUFFLFlBQVksQ0FBQyxPQUFPO0lBQ3BDLGVBQWUsRUFBRTtRQUNmLFVBQVUsRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUNoRCxNQUFNLEVBQUUsWUFBWSxDQUFDLEdBQUcsQ0FBQyxlQUFlO1FBQ3hDLGlCQUFpQixFQUFFLEVBQUUsRUFBRSwyQkFBMkI7UUFDbEQsa0JBQWtCLEVBQUUsRUFBRTtRQUN0QixXQUFXLEVBQUUsVUFBVSxZQUFZLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFO0tBQzlEO0NBQ0YsQ0FBQyxDQUFDO0FBRUgsZUFBZSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUU1Qyx1QkFBdUI7QUFDdkIsTUFBTSxTQUFTLEdBQUc7SUFDaEIsT0FBTyxFQUFFLHFCQUFxQjtJQUM5QixXQUFXLEVBQUUsS0FBSztJQUNsQixTQUFTLEVBQUUsS0FBSztJQUNoQixVQUFVLEVBQUUscUNBQXFDO0NBQ2xELENBQUM7QUFFRixNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUU7SUFDakQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNuQyxDQUFDLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBOZXR3b3JrU3RhY2sgfSBmcm9tICcuLi9saWIvbmV0d29yay1zdGFjayc7XG5pbXBvcnQgeyBEYXRhU3RhY2sgfSBmcm9tICcuLi9saWIvZGF0YS1zdGFjayc7XG5pbXBvcnQgeyBDb21wdXRlU3RhY2sgfSBmcm9tICcuLi9saWIvY29tcHV0ZS1zdGFjayc7XG5pbXBvcnQgeyBGcm9udGVuZFN0YWNrIH0gZnJvbSAnLi4vbGliL2Zyb250ZW5kLXN0YWNrJztcbmltcG9ydCB7IE1jcFJ1bnRpbWVTdGFjayB9IGZyb20gJy4uL2xpYi9tY3AtcnVudGltZS1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIEVudmlyb25tZW50IGNvbmZpZ3VyYXRpb25cbi8vIEV4cGxpY2l0bHkgY2hlY2sgbXVsdGlwbGUgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciByZWdpb25cbmNvbnN0IHJlZ2lvbiA9IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCBwcm9jZXNzLmVudi5BV1NfUkVHSU9OIHx8IHByb2Nlc3MuZW52LkFXU19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJztcblxuY29uc29sZS5sb2coYPCfjI0gRGVwbG95aW5nIHRvIHJlZ2lvbjogJHtyZWdpb259YCk7XG5cbmNvbnN0IGVudiA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgcmVnaW9uOiByZWdpb24sXG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayAxOiBOZXR3b3JrIEluZnJhc3RydWN0dXJlXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5jb25zdCBuZXR3b3JrU3RhY2sgPSBuZXcgTmV0d29ya1N0YWNrKGFwcCwgJ0NhdGFsb2dBZ2VudHNOZXR3b3JrU3RhY2snLCB7XG4gIGVudixcbiAgZGVzY3JpcHRpb246ICdOZXR3b3JrIGluZnJhc3RydWN0dXJlIGZvciBEYXRhIENhdGFsb2cgQWdlbnRzJyxcbiAgLy8gQWdlbnRDb3JlLWNvbXBhdGlibGUgQVpzIGFyZSBhdXRvLWRldGVjdGVkIGJhc2VkIG9uIHJlZ2lvblxuICAvLyBDYW4gYmUgb3ZlcnJpZGRlbiB2aWEgY29udGV4dCBpZiBuZWVkZWQ6XG4gIC8vIGNkayBkZXBsb3kgLWMgYWdlbnRDb3JlQXoxPXVzLWVhc3QtMWEgLWMgYWdlbnRDb3JlQXoyPXVzLWVhc3QtMWIgLWMgYWdlbnRDb3JlQXozPXVzLWVhc3QtMWRcbn0pO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayAyOiBEYXRhIExheWVyIChSRFMsIEdsdWUsIFMzKVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuY29uc3QgZGF0YVN0YWNrID0gbmV3IERhdGFTdGFjayhhcHAsICdDYXRhbG9nQWdlbnRzRGF0YVN0YWNrJywge1xuICBlbnYsXG4gIGRlc2NyaXB0aW9uOiAnRGF0YSBsYXllciBpbmZyYXN0cnVjdHVyZSAoUkRTLCBHbHVlLCBTMyknLFxuICBuZXR3b3JrT3V0cHV0czogbmV0d29ya1N0YWNrLm91dHB1dHMsXG4gIGRhdGFiYXNlTmFtZTogYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZGF0YWJhc2VOYW1lJykgfHwgJ3VuaXR5Y2F0YWxvZycsXG4gIGRhdGFiYXNlVXNlcm5hbWU6IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2RhdGFiYXNlVXNlcm5hbWUnKSB8fCAndW5pdHljYXRhbG9nJyxcbn0pO1xuXG5kYXRhU3RhY2suYWRkRGVwZW5kZW5jeShuZXR3b3JrU3RhY2spO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayAzOiBDb21wdXRlIExheWVyIChFQ1MsIFVuaXR5IENhdGFsb2csIFN0cmVhbWxpdCwgQUxCLCBDb2duaXRvKVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuY29uc3QgY29tcHV0ZVN0YWNrID0gbmV3IENvbXB1dGVTdGFjayhhcHAsICdDYXRhbG9nQWdlbnRzQ29tcHV0ZVN0YWNrJywge1xuICBlbnYsXG4gIGRlc2NyaXB0aW9uOiAnQ29tcHV0ZSBsYXllciAoRUNTLCBVbml0eSBDYXRhbG9nLCBTdHJlYW1saXQsIEFMQiB3aXRoIENvZ25pdG8pJyxcbiAgbmV0d29ya091dHB1dHM6IG5ldHdvcmtTdGFjay5vdXRwdXRzLFxuICBkYXRhT3V0cHV0czogZGF0YVN0YWNrLm91dHB1dHMsXG4gIHVuaXR5Q2F0YWxvZ0ltYWdlOiBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd1bml0eUNhdGFsb2dJbWFnZScpIHx8ICd1bml0eWNhdGFsb2cvdW5pdHljYXRhbG9nOmxhdGVzdCcsXG4gIHN0cmVhbWxpdEltYWdlVGFnOiBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdHJlYW1saXRJbWFnZVRhZycpIHx8ICdsYXRlc3QnLFxuICBhZG1pbkVtYWlsOiBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdhZG1pbkVtYWlsJyksXG59KTtcblxuY29tcHV0ZVN0YWNrLmFkZERlcGVuZGVuY3koZGF0YVN0YWNrKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3RhY2sgNDogTUNQIFJ1bnRpbWUgTGF5ZXIgKEFnZW50Q29yZSBSdW50aW1lcywgQVBJIEdhdGV3YXkpXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBOb3RlOiBGcm9udGVuZFN0YWNrIHJlbW92ZWQgLSBDb2duaXRvIG5vdyBpbnRlZ3JhdGVkIGluIENvbXB1dGVTdGFja1xuY29uc3QgbWNwUnVudGltZVN0YWNrID0gbmV3IE1jcFJ1bnRpbWVTdGFjayhhcHAsICdDYXRhbG9nQWdlbnRzTWNwUnVudGltZVN0YWNrJywge1xuICBlbnYsXG4gIGRlc2NyaXB0aW9uOiAnTUNQIEFnZW50Q29yZSBSdW50aW1lcyBhbmQgQVBJIEdhdGV3YXknLFxuICBuZXR3b3JrT3V0cHV0czogbmV0d29ya1N0YWNrLm91dHB1dHMsXG4gIGZyb250ZW5kT3V0cHV0czoge1xuICAgIGFsYkRuc05hbWU6IGNvbXB1dGVTdGFjay5hbGIubG9hZEJhbGFuY2VyRG5zTmFtZSxcbiAgICBhbGJBcm46IGNvbXB1dGVTdGFjay5hbGIubG9hZEJhbGFuY2VyQXJuLFxuICAgIGNvZ25pdG9Vc2VyUG9vbElkOiAnJywgLy8gTm90IG5lZWRlZCBmb3IgTUNQIHN0YWNrXG4gICAgY29nbml0b1VzZXJQb29sQXJuOiAnJyxcbiAgICBhcGlFbmRwb2ludDogYGh0dHA6Ly8ke2NvbXB1dGVTdGFjay5hbGIubG9hZEJhbGFuY2VyRG5zTmFtZX1gLFxuICB9LFxufSk7XG5cbm1jcFJ1bnRpbWVTdGFjay5hZGREZXBlbmRlbmN5KGNvbXB1dGVTdGFjayk7XG5cbi8vIEFkZCBzdGFjay1sZXZlbCB0YWdzXG5jb25zdCBzdGFja1RhZ3MgPSB7XG4gIFByb2plY3Q6ICdjYXRhbG9nLWFnZW50cy1kZW1vJyxcbiAgRW52aXJvbm1lbnQ6ICdkZXYnLFxuICBNYW5hZ2VkQnk6ICdDREsnLFxuICBSZXBvc2l0b3J5OiAnc2FtcGxlLWRhdGEtY2F0YWxvZy1hZ2VudHMtd2l0aC1tY3AnLFxufTtcblxuT2JqZWN0LmVudHJpZXMoc3RhY2tUYWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgY2RrLlRhZ3Mub2YoYXBwKS5hZGQoa2V5LCB2YWx1ZSk7XG59KTtcblxuYXBwLnN5bnRoKCk7XG4iXX0=