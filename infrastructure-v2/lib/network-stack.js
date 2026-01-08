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
exports.NetworkStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const agentcore_azs_1 = require("./agentcore-azs");
class NetworkStack extends cdk.Stack {
    outputs;
    constructor(scope, id, props) {
        super(scope, id, props);
        // Get AgentCore-compatible AZ names dynamically based on region
        const region = cdk.Stack.of(this).region;
        // Try to get AZs from multiple sources (in priority order):
        // 1. Explicit props
        // 2. CDK context
        // 3. Automatic detection based on region
        const contextAzs = {
            az1: props?.agentCoreAz1 || this.node.tryGetContext('agentCoreAz1'),
            az2: props?.agentCoreAz2 || this.node.tryGetContext('agentCoreAz2'),
            az3: props?.agentCoreAz3 || this.node.tryGetContext('agentCoreAz3'),
        };
        const agentCoreAzNames = (0, agentcore_azs_1.getAgentCoreAzs)(region, contextAzs);
        if (!agentCoreAzNames) {
            // Region is not configured
            cdk.Annotations.of(this).addWarning((0, agentcore_azs_1.getRegionConfigInstructions)(region));
        }
        else if ((0, agentcore_azs_1.isAgentCoreRegion)(region)) {
            cdk.Annotations.of(this).addInfo(`Using AgentCore-compatible AZs for ${region}: ${agentCoreAzNames.join(', ')}`);
        }
        // VPC - matching Terraform configuration (10.0.0.0/16)
        const vpc = new ec2.Vpc(this, 'CatalogAgentsVpc', {
            vpcName: 'catalog-agents-vpc',
            ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
            maxAzs: 2,
            natGateways: 1,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            subnetConfiguration: [
                {
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: 24,
                    mapPublicIpOnLaunch: true,
                },
                {
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                },
            ],
        });
        // Add S3 Gateway Endpoint
        vpc.addGatewayEndpoint('S3Endpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
        });
        // Security Group for RDS
        const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
            vpc,
            description: 'Security group for Unity Catalog RDS',
            securityGroupName: 'catalog-agents-rds-sg',
            allowAllOutbound: true,
        });
        // Security Group for ECS Tasks
        const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
            vpc,
            description: 'Security group for ECS tasks',
            securityGroupName: 'catalog-agents-ecs-sg',
            allowAllOutbound: true,
        });
        // Security Group for Application Load Balancer
        const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
            vpc,
            description: 'Security group for Application Load Balancer',
            securityGroupName: 'catalog-agents-alb-sg',
            allowAllOutbound: true,
        });
        // Security Group for MCP AgentCore Runtimes
        const mcpSecurityGroup = new ec2.SecurityGroup(this, 'McpSecurityGroup', {
            vpc,
            description: 'Security group for MCP AgentCore Runtimes',
            securityGroupName: 'catalog-agents-mcp-sg',
            allowAllOutbound: true,
        });
        // Configure security group rules
        // ALB accepts HTTP and HTTPS from anywhere
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP from anywhere');
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS from anywhere');
        // ECS tasks accept traffic from ALB on ports 8080 and 8501
        ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(8080), 'Allow traffic from ALB on Unity Catalog port');
        ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(8501), 'Allow traffic from ALB on Streamlit port');
        // RDS accepts traffic from ECS tasks on PostgreSQL port
        rdsSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.tcp(5432), 'Allow PostgreSQL from ECS tasks');
        // MCP runtimes accept HTTPS traffic
        mcpSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS for MCP runtimes');
        // Select AgentCore-compatible subnets based on configured AZs
        let agentCoreCompatibleSubnets = [];
        if (agentCoreAzNames && agentCoreAzNames.length === 3) {
            const selectedSubnets = vpc.selectSubnets({
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                availabilityZones: agentCoreAzNames,
            });
            agentCoreCompatibleSubnets = selectedSubnets.subnets;
        }
        else {
            // Fallback to all private subnets if AZs not configured
            cdk.Annotations.of(this).addWarning('Using all private subnets for AgentCore (AZs not configured). ' +
                'This may cause deployment failures if the region/AZs are not AgentCore-compatible.');
            agentCoreCompatibleSubnets = vpc.privateSubnets;
        }
        // Outputs
        this.outputs = {
            vpc,
            publicSubnets: vpc.publicSubnets,
            privateSubnets: vpc.privateSubnets,
            agentCoreCompatibleSubnets,
            rdsSecurityGroup,
            ecsSecurityGroup,
            albSecurityGroup,
            mcpSecurityGroup,
        };
        // CloudFormation Outputs
        new cdk.CfnOutput(this, 'VpcId', {
            value: vpc.vpcId,
            description: 'VPC ID',
            exportName: `${this.stackName}-VpcId`,
        });
        new cdk.CfnOutput(this, 'PublicSubnetIds', {
            value: vpc.publicSubnets.map(s => s.subnetId).join(','),
            description: 'Public Subnet IDs',
            exportName: `${this.stackName}-PublicSubnetIds`,
        });
        new cdk.CfnOutput(this, 'PrivateSubnetIds', {
            value: vpc.privateSubnets.map(s => s.subnetId).join(','),
            description: 'Private Subnet IDs',
            exportName: `${this.stackName}-PrivateSubnetIds`,
        });
        // Add tags to all resources
        cdk.Tags.of(this).add('Project', 'catalog-agents-demo');
        cdk.Tags.of(this).add('Environment', 'dev');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
    }
}
exports.NetworkStack = NetworkStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0d29yay1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5ldHdvcmstc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBRW5DLHlEQUEyQztBQUUzQyxtREFBa0c7QUFhbEcsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDekIsT0FBTyxDQUFzQjtJQUU3QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGdFQUFnRTtRQUNoRSxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFFekMsNERBQTREO1FBQzVELG9CQUFvQjtRQUNwQixpQkFBaUI7UUFDakIseUNBQXlDO1FBQ3pDLE1BQU0sVUFBVSxHQUFHO1lBQ2pCLEdBQUcsRUFBRSxLQUFLLEVBQUUsWUFBWSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQztZQUNuRSxHQUFHLEVBQUUsS0FBSyxFQUFFLFlBQVksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUM7WUFDbkUsR0FBRyxFQUFFLEtBQUssRUFBRSxZQUFZLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDO1NBQ3BFLENBQUM7UUFFRixNQUFNLGdCQUFnQixHQUFHLElBQUEsK0JBQWUsRUFBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFFN0QsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDdEIsMkJBQTJCO1lBQzNCLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FDakMsSUFB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WUFDeEQsV0FBVyxFQUFFLG9CQUFvQjtZQUNqQyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxtQkFBbUI7U0FDakQsQ0FBQyxDQUFDO1FBRUgsNEJBQTRCO1FBQzVCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUscUJBQXFCLENBQUMsQ0FBQztRQUN4RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNGO0FBekxELG9DQXlMQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCB7IE5ldHdvcmtTdGFja091dHB1dHMgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEFnZW50Q29yZUF6cywgaXNBZ2VudENvcmVSZWdpb24sIGdldFJlZ2lvbkNvbmZpZ0luc3RydWN0aW9ucyB9IGZyb20gJy4vYWdlbnRjb3JlLWF6cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmV0d29ya1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIC8qKlxuICAgKiBBZ2VudENvcmUtY29tcGF0aWJsZSBhdmFpbGFiaWxpdHkgem9uZSBuYW1lcyBmb3IgdXMtZWFzdC0xXG4gICAqIE1hcCB1c2UxLWF6MSwgdXNlMS1hejIsIHVzZTEtYXo0IHRvIHlvdXIgYWNjb3VudCdzIEFaIG5hbWVzXG4gICAqIFJ1bjogYXdzIGVjMiBkZXNjcmliZS1hdmFpbGFiaWxpdHktem9uZXMgLS1yZWdpb24gdXMtZWFzdC0xXG4gICAqL1xuICBhZ2VudENvcmVBejE/OiBzdHJpbmc7XG4gIGFnZW50Q29yZUF6Mj86IHN0cmluZztcbiAgYWdlbnRDb3JlQXozPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTmV0d29ya1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IG91dHB1dHM6IE5ldHdvcmtTdGFja091dHB1dHM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBOZXR3b3JrU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gR2V0IEFnZW50Q29yZS1jb21wYXRpYmxlIEFaIG5hbWVzIGR5bmFtaWNhbGx5IGJhc2VkIG9uIHJlZ2lvblxuICAgIGNvbnN0IHJlZ2lvbiA9IGNkay5TdGFjay5vZih0aGlzKS5yZWdpb247XG4gICAgXG4gICAgLy8gVHJ5IHRvIGdldCBBWnMgZnJvbSBtdWx0aXBsZSBzb3VyY2VzIChpbiBwcmlvcml0eSBvcmRlcik6XG4gICAgLy8gMS4gRXhwbGljaXQgcHJvcHNcbiAgICAvLyAyLiBDREsgY29udGV4dFxuICAgIC8vIDMuIEF1dG9tYXRpYyBkZXRlY3Rpb24gYmFzZWQgb24gcmVnaW9uXG4gICAgY29uc3QgY29udGV4dEF6cyA9IHtcbiAgICAgIGF6MTogcHJvcHM/LmFnZW50Q29yZUF6MSB8fCB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnYWdlbnRDb3JlQXoxJyksXG4gICAgICBhejI6IHByb3BzPy5hZ2VudENvcmVBejIgfHwgdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2FnZW50Q29yZUF6MicpLFxuICAgICAgYXozOiBwcm9wcz8uYWdlbnRDb3JlQXozIHx8IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdhZ2VudENvcmVBejMnKSxcbiAgICB9O1xuXG4gICAgY29uc3QgYWdlbnRDb3JlQXpOYW1lcyA9IGdldEFnZW50Q29yZUF6cyhyZWdpb24sIGNvbnRleHRBenMpO1xuXG4gICAgaWYgKCFhZ2VudENvcmVBek5hbWVzKSB7XG4gICAgICAvLyBSZWdpb24gaXMgbm90IGNvbmZpZ3VyZWRcbiAgICAgIGNkay5Bbm5vdGF0aW9ucy5vZih0aGlzKS5hZGRXYXJuaW5nKFxuICAgICAgICBnZXRSZWdpb25Db25maWdJbnN0cnVjdGlvbnMocmVnaW9uKVxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKGlzQWdlbnRDb3JlUmVnaW9uKHJlZ2lvbikpIHtcbiAgICAgIGNkay5Bbm5vdGF0aW9ucy5vZih0aGlzKS5hZGRJbmZvKFxuICAgICAgICBgVXNpbmcgQWdlbnRDb3JlLWNvbXBhdGlibGUgQVpzIGZvciAke3JlZ2lvbn06ICR7YWdlbnRDb3JlQXpOYW1lcy5qb2luKCcsICcpfWBcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gVlBDIC0gbWF0Y2hpbmcgVGVycmFmb3JtIGNvbmZpZ3VyYXRpb24gKDEwLjAuMC4wLzE2KVxuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdDYXRhbG9nQWdlbnRzVnBjJywge1xuICAgICAgdnBjTmFtZTogJ2NhdGFsb2ctYWdlbnRzLXZwYycsXG4gICAgICBpcEFkZHJlc3NlczogZWMyLklwQWRkcmVzc2VzLmNpZHIoJzEwLjAuMC4wLzE2JyksXG4gICAgICBtYXhBenM6IDIsXG4gICAgICBuYXRHYXRld2F5czogMSxcbiAgICAgIGVuYWJsZURuc0hvc3RuYW1lczogdHJ1ZSxcbiAgICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWUsXG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnUHVibGljJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG1hcFB1YmxpY0lwT25MYXVuY2g6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnUHJpdmF0ZScsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIFMzIEdhdGV3YXkgRW5kcG9pbnRcbiAgICB2cGMuYWRkR2F0ZXdheUVuZHBvaW50KCdTM0VuZHBvaW50Jywge1xuICAgICAgc2VydmljZTogZWMyLkdhdGV3YXlWcGNFbmRwb2ludEF3c1NlcnZpY2UuUzMsXG4gICAgICBzdWJuZXRzOiBbeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH1dLFxuICAgIH0pO1xuXG4gICAgLy8gU2VjdXJpdHkgR3JvdXAgZm9yIFJEU1xuICAgIGNvbnN0IHJkc1NlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ1Jkc1NlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGMsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBVbml0eSBDYXRhbG9nIFJEUycsXG4gICAgICBzZWN1cml0eUdyb3VwTmFtZTogJ2NhdGFsb2ctYWdlbnRzLXJkcy1zZycsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gU2VjdXJpdHkgR3JvdXAgZm9yIEVDUyBUYXNrc1xuICAgIGNvbnN0IGVjc1NlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ0Vjc1NlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGMsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBFQ1MgdGFza3MnLFxuICAgICAgc2VjdXJpdHlHcm91cE5hbWU6ICdjYXRhbG9nLWFnZW50cy1lY3Mtc2cnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFNlY3VyaXR5IEdyb3VwIGZvciBBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyXG4gICAgY29uc3QgYWxiU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnQWxiU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIEFwcGxpY2F0aW9uIExvYWQgQmFsYW5jZXInLFxuICAgICAgc2VjdXJpdHlHcm91cE5hbWU6ICdjYXRhbG9nLWFnZW50cy1hbGItc2cnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFNlY3VyaXR5IEdyb3VwIGZvciBNQ1AgQWdlbnRDb3JlIFJ1bnRpbWVzXG4gICAgY29uc3QgbWNwU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnTWNwU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIE1DUCBBZ2VudENvcmUgUnVudGltZXMnLFxuICAgICAgc2VjdXJpdHlHcm91cE5hbWU6ICdjYXRhbG9nLWFnZW50cy1tY3Atc2cnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIENvbmZpZ3VyZSBzZWN1cml0eSBncm91cCBydWxlc1xuICAgIC8vIEFMQiBhY2NlcHRzIEhUVFAgYW5kIEhUVFBTIGZyb20gYW55d2hlcmVcbiAgICBhbGJTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDgwKSxcbiAgICAgICdBbGxvdyBIVFRQIGZyb20gYW55d2hlcmUnXG4gICAgKTtcbiAgICBhbGJTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDQ0MyksXG4gICAgICAnQWxsb3cgSFRUUFMgZnJvbSBhbnl3aGVyZSdcbiAgICApO1xuXG4gICAgLy8gRUNTIHRhc2tzIGFjY2VwdCB0cmFmZmljIGZyb20gQUxCIG9uIHBvcnRzIDgwODAgYW5kIDg1MDFcbiAgICBlY3NTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgYWxiU2VjdXJpdHlHcm91cCxcbiAgICAgIGVjMi5Qb3J0LnRjcCg4MDgwKSxcbiAgICAgICdBbGxvdyB0cmFmZmljIGZyb20gQUxCIG9uIFVuaXR5IENhdGFsb2cgcG9ydCdcbiAgICApO1xuICAgIGVjc1NlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBhbGJTZWN1cml0eUdyb3VwLFxuICAgICAgZWMyLlBvcnQudGNwKDg1MDEpLFxuICAgICAgJ0FsbG93IHRyYWZmaWMgZnJvbSBBTEIgb24gU3RyZWFtbGl0IHBvcnQnXG4gICAgKTtcblxuICAgIC8vIFJEUyBhY2NlcHRzIHRyYWZmaWMgZnJvbSBFQ1MgdGFza3Mgb24gUG9zdGdyZVNRTCBwb3J0XG4gICAgcmRzU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjc1NlY3VyaXR5R3JvdXAsXG4gICAgICBlYzIuUG9ydC50Y3AoNTQzMiksXG4gICAgICAnQWxsb3cgUG9zdGdyZVNRTCBmcm9tIEVDUyB0YXNrcydcbiAgICApO1xuXG4gICAgLy8gTUNQIHJ1bnRpbWVzIGFjY2VwdCBIVFRQUyB0cmFmZmljXG4gICAgbWNwU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmFueUlwdjQoKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg0NDMpLFxuICAgICAgJ0FsbG93IEhUVFBTIGZvciBNQ1AgcnVudGltZXMnXG4gICAgKTtcblxuICAgIC8vIFNlbGVjdCBBZ2VudENvcmUtY29tcGF0aWJsZSBzdWJuZXRzIGJhc2VkIG9uIGNvbmZpZ3VyZWQgQVpzXG4gICAgbGV0IGFnZW50Q29yZUNvbXBhdGlibGVTdWJuZXRzOiBlYzIuSVN1Ym5ldFtdID0gW107XG4gICAgaWYgKGFnZW50Q29yZUF6TmFtZXMgJiYgYWdlbnRDb3JlQXpOYW1lcy5sZW5ndGggPT09IDMpIHtcbiAgICAgIGNvbnN0IHNlbGVjdGVkU3VibmV0cyA9IHZwYy5zZWxlY3RTdWJuZXRzKHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgYXZhaWxhYmlsaXR5Wm9uZXM6IGFnZW50Q29yZUF6TmFtZXMsXG4gICAgICB9KTtcbiAgICAgIGFnZW50Q29yZUNvbXBhdGlibGVTdWJuZXRzID0gc2VsZWN0ZWRTdWJuZXRzLnN1Ym5ldHM7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEZhbGxiYWNrIHRvIGFsbCBwcml2YXRlIHN1Ym5ldHMgaWYgQVpzIG5vdCBjb25maWd1cmVkXG4gICAgICBjZGsuQW5ub3RhdGlvbnMub2YodGhpcykuYWRkV2FybmluZyhcbiAgICAgICAgJ1VzaW5nIGFsbCBwcml2YXRlIHN1Ym5ldHMgZm9yIEFnZW50Q29yZSAoQVpzIG5vdCBjb25maWd1cmVkKS4gJyArXG4gICAgICAgICdUaGlzIG1heSBjYXVzZSBkZXBsb3ltZW50IGZhaWx1cmVzIGlmIHRoZSByZWdpb24vQVpzIGFyZSBub3QgQWdlbnRDb3JlLWNvbXBhdGlibGUuJ1xuICAgICAgKTtcbiAgICAgIGFnZW50Q29yZUNvbXBhdGlibGVTdWJuZXRzID0gdnBjLnByaXZhdGVTdWJuZXRzO1xuICAgIH1cblxuICAgIC8vIE91dHB1dHNcbiAgICB0aGlzLm91dHB1dHMgPSB7XG4gICAgICB2cGMsXG4gICAgICBwdWJsaWNTdWJuZXRzOiB2cGMucHVibGljU3VibmV0cyxcbiAgICAgIHByaXZhdGVTdWJuZXRzOiB2cGMucHJpdmF0ZVN1Ym5ldHMsXG4gICAgICBhZ2VudENvcmVDb21wYXRpYmxlU3VibmV0cyxcbiAgICAgIHJkc1NlY3VyaXR5R3JvdXAsXG4gICAgICBlY3NTZWN1cml0eUdyb3VwLFxuICAgICAgYWxiU2VjdXJpdHlHcm91cCxcbiAgICAgIG1jcFNlY3VyaXR5R3JvdXAsXG4gICAgfTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9uIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVnBjSWQnLCB7XG4gICAgICB2YWx1ZTogdnBjLnZwY0lkLFxuICAgICAgZGVzY3JpcHRpb246ICdWUEMgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVZwY0lkYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQdWJsaWNTdWJuZXRJZHMnLCB7XG4gICAgICB2YWx1ZTogdnBjLnB1YmxpY1N1Ym5ldHMubWFwKHMgPT4gcy5zdWJuZXRJZCkuam9pbignLCcpLFxuICAgICAgZGVzY3JpcHRpb246ICdQdWJsaWMgU3VibmV0IElEcycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUHVibGljU3VibmV0SWRzYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcml2YXRlU3VibmV0SWRzJywge1xuICAgICAgdmFsdWU6IHZwYy5wcml2YXRlU3VibmV0cy5tYXAocyA9PiBzLnN1Ym5ldElkKS5qb2luKCcsJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByaXZhdGUgU3VibmV0IElEcycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUHJpdmF0ZVN1Ym5ldElkc2AsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgdGFncyB0byBhbGwgcmVzb3VyY2VzXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ2NhdGFsb2ctYWdlbnRzLWRlbW8nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgJ2RldicpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTWFuYWdlZEJ5JywgJ0NESycpO1xuICB9XG59XG4iXX0=