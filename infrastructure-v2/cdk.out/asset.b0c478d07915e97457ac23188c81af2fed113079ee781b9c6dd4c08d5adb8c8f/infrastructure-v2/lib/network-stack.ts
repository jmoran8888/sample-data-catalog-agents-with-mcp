import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { NetworkStackOutputs } from './types';
import { getAgentCoreAzs, isAgentCoreRegion, getRegionConfigInstructions } from './agentcore-azs';

export interface NetworkStackProps extends cdk.StackProps {
  /**
   * AgentCore-compatible availability zone names for us-east-1
   * Map use1-az1, use1-az2, use1-az4 to your account's AZ names
   * Run: aws ec2 describe-availability-zones --region us-east-1
   */
  agentCoreAz1?: string;
  agentCoreAz2?: string;
  agentCoreAz3?: string;
}

export class NetworkStack extends cdk.Stack {
  public readonly outputs: NetworkStackOutputs;

  constructor(scope: Construct, id: string, props?: NetworkStackProps) {
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

    const agentCoreAzNames = getAgentCoreAzs(region, contextAzs);

    if (!agentCoreAzNames) {
      // Region is not configured
      cdk.Annotations.of(this).addWarning(
        getRegionConfigInstructions(region)
      );
    } else if (isAgentCoreRegion(region)) {
      cdk.Annotations.of(this).addInfo(
        `Using AgentCore-compatible AZs for ${region}: ${agentCoreAzNames.join(', ')}`
      );
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
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from anywhere'
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from anywhere'
    );

    // ECS tasks accept traffic from ALB on ports 8080 and 8501
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(8080),
      'Allow traffic from ALB on Unity Catalog port'
    );
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(8501),
      'Allow traffic from ALB on Streamlit port'
    );

    // RDS accepts traffic from ECS tasks on PostgreSQL port
    rdsSecurityGroup.addIngressRule(
      ecsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from ECS tasks'
    );

    // MCP runtimes accept HTTPS traffic
    mcpSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS for MCP runtimes'
    );

    // Select AgentCore-compatible subnets based on configured AZs
    let agentCoreCompatibleSubnets: ec2.ISubnet[] = [];
    if (agentCoreAzNames && agentCoreAzNames.length === 3) {
      const selectedSubnets = vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        availabilityZones: agentCoreAzNames,
      });
      agentCoreCompatibleSubnets = selectedSubnets.subnets;
    } else {
      // Fallback to all private subnets if AZs not configured
      cdk.Annotations.of(this).addWarning(
        'Using all private subnets for AgentCore (AZs not configured). ' +
        'This may cause deployment failures if the region/AZs are not AgentCore-compatible.'
      );
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
