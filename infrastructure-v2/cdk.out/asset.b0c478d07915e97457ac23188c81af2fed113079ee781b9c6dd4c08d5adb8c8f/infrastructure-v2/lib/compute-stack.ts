import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as actions from 'aws-cdk-lib/aws-elasticloadbalancingv2-actions';
import * as path from 'path';
import { NetworkStackOutputs, DataStackOutputs, ComputeStackOutputs } from './types';

export interface ComputeStackProps extends cdk.StackProps {
  networkOutputs: NetworkStackOutputs;
  dataOutputs: DataStackOutputs;
  unityCatalogImage?: string;
  streamlitImageTag?: string;
  adminEmail?: string;
}

export class ComputeStack extends cdk.Stack {
  public readonly outputs: ComputeStackOutputs;
  public readonly alb: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { networkOutputs, dataOutputs } = props;
    const unityCatalogImage = props.unityCatalogImage || 'unitycatalog/unitycatalog:latest';
    const streamlitImageTag = props.streamlitImageTag || 'latest';

    // ==============================================
    // ECS Cluster
    // ==============================================

    const ecsCluster = new ecs.Cluster(this, 'CatalogAgentsCluster', {
      clusterName: 'catalog-agents-cluster',
      vpc: networkOutputs.vpc,
      // Using deprecated containerInsights for now (v2 requires different configuration)
      containerInsights: true,
    });

    // ==============================================
    // IAM Roles
    // ==============================================

    // ECS Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      roleName: 'catalog-agents-ecs-task-execution-role',
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(
          this,
          'EcsTaskExecutionPolicy',
          'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
        ),
      ],
    });

    // Grant access to RDS secret
    dataOutputs.rdsSecret.grantRead(taskExecutionRole);

    // ECS Task Role (for tasks to access AWS services)
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      roleName: 'catalog-agents-ecs-task-role',
    });

    // Grant Glue permissions to task role
    taskRole.addToPolicy(new iam.PolicyStatement({
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

    // Grant Bedrock permissions to task role
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        'arn:aws:bedrock:*:*:inference-profile/*',
        'arn:aws:bedrock:*::foundation-model/*',
      ],
    }));


    // ==============================================
    // CloudWatch Log Groups
    // ==============================================

    const unityCatalogLogGroup = new logs.LogGroup(this, 'UnityCatalogLogGroup', {
      logGroupName: '/ecs/unity-catalog',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const streamlitLogGroup = new logs.LogGroup(this, 'StreamlitLogGroup', {
      logGroupName: '/ecs/streamlit-app',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ==============================================
    // Unity Catalog Task Definition
    // ==============================================

    const unityCatalogTaskDefinition = new ecs.FargateTaskDefinition(this, 'UnityCatalogTaskDef', {
      family: 'unity-catalog',
      cpu: 1024,
      memoryLimitMiB: 2048,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    const unityCatalogContainer = unityCatalogTaskDefinition.addContainer('unity-catalog', {
      image: ecs.ContainerImage.fromRegistry(unityCatalogImage),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup: unityCatalogLogGroup,
      }),
      environment: {
        UNITY_CATALOG_DB_URL: `jdbc:postgresql://${dataOutputs.rdsCluster.clusterEndpoint.hostname}:5432/unitycatalog`,
      },
      secrets: {
        UNITY_CATALOG_DB_USER: ecs.Secret.fromSecretsManager(
          dataOutputs.rdsSecret,
          'username'
        ),
        UNITY_CATALOG_DB_PASSWORD: ecs.Secret.fromSecretsManager(
          dataOutputs.rdsSecret,
          'password'
        ),
      },
    });

    unityCatalogContainer.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    // ==============================================
    // Streamlit Task Definition
    // ==============================================

    const streamlitTaskDefinition = new ecs.FargateTaskDefinition(this, 'StreamlitTaskDef', {
      family: 'streamlit-app',
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    // Build Docker image directly from local source (CDK handles build and push automatically)
    // Build context is project root
    const streamlitContainer = streamlitTaskDefinition.addContainer('streamlit-app', {
      image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, '../..'), {
        file: 'Dockerfile.streamlit',
        platform: ecr_assets.Platform.LINUX_AMD64,
      }),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup: streamlitLogGroup,
      }),
      environment: {
        // Will be updated with ALB DNS after FrontendStack is created
        UNITY_CATALOG_URL: 'http://unity-catalog.local:8080/api/2.1/unity-catalog',
        AWS_DEFAULT_REGION: this.region,
      },
    });

    streamlitContainer.addPortMappings({
      containerPort: 8501,
      protocol: ecs.Protocol.TCP,
    });

    // ==============================================
    // Application Load Balancer
    // ==============================================

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'CatalogAgentsALB', {
      vpc: networkOutputs.vpc,
      internetFacing: true,
      vpcSubnets: {
        subnets: networkOutputs.publicSubnets,
      },
      securityGroup: networkOutputs.albSecurityGroup,
      loadBalancerName: 'catalog-agents-alb',
      deletionProtection: false,
    });

    // ==============================================
    // Target Groups
    // ==============================================

    const unityCatalogTargetGroup = new elbv2.ApplicationTargetGroup(this, 'UnityCatalogTargetGroup', {
      vpc: networkOutputs.vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/api/2.1/unity-catalog/catalogs',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    const streamlitTargetGroup = new elbv2.ApplicationTargetGroup(this, 'StreamlitTargetGroup', {
      vpc: networkOutputs.vpc,
      port: 8501,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // ==============================================
    // Cognito User Pool (for Authentication)
    // ==============================================

    const userPool = new cognito.UserPool(this, 'CatalogAgentsUserPool', {
      userPoolName: 'catalog-agents-users',
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      selfSignUpEnabled: false,
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Cognito User Pool Domain
    const userPoolDomain = new cognito.UserPoolDomain(this, 'CatalogAgentsUserPoolDomain', {
      userPool,
      cognitoDomain: {
        domainPrefix: `catalog-agents-${this.account.substring(0, 8)}`,
      },
    });

    // Create Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'CatalogAgentsUserPoolClient', {
      userPool,
      userPoolClientName: 'catalog-agents-client',
      generateSecret: true,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          `http://${this.alb.loadBalancerDnsName}/oauth2/idpresponse`,
        ],
        logoutUrls: [
          `http://${this.alb.loadBalancerDnsName}/`,
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });

    // Optional: Create admin user if email provided
    if (props.adminEmail) {
      new cognito.CfnUserPoolUser(this, 'AdminUser', {
        userPoolId: userPool.userPoolId,
        username: props.adminEmail,
        userAttributes: [
          {
            name: 'email',
            value: props.adminEmail,
          },
          {
            name: 'email_verified',
            value: 'true',
          },
        ],
        messageAction: 'SUPPRESS',
      });
    }

    // ==============================================
    // ALB Listeners with Cognito Authentication
    // ==============================================

    // HTTP listener - forward to port 443
    const httpListener = this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        port: '443',
        protocol: 'HTTP',
        permanent: true,
      }),
    });

    // HTTP listener on 443 with Cognito authentication
    const httpsListener = this.alb.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: new actions.AuthenticateCognitoAction({
        userPool,
        userPoolClient,
        userPoolDomain,
        next: elbv2.ListenerAction.forward([streamlitTargetGroup]),
      }),
    });

    // Add routing rule for Unity Catalog with Cognito auth
    httpsListener.addAction('UnityCatalogAction', {
      priority: 100,
      conditions: [
        elbv2.ListenerCondition.pathPatterns([
          '/api/*',
          '/docs/*',
          '/openapi.json',
        ]),
      ],
      action: new actions.AuthenticateCognitoAction({
        userPool,
        userPoolClient,
        userPoolDomain,
        next: elbv2.ListenerAction.forward([unityCatalogTargetGroup]),
      }),
    });

    // ==============================================
    // ECS Services
    // ==============================================

    const unityCatalogService = new ecs.FargateService(this, 'UnityCatalogService', {
      cluster: ecsCluster,
      taskDefinition: unityCatalogTaskDefinition,
      serviceName: 'unity-catalog-service',
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: false,
      vpcSubnets: {
        subnets: networkOutputs.privateSubnets,
      },
      securityGroups: [networkOutputs.ecsSecurityGroup],
    });

    // Register Unity Catalog service with target group
    unityCatalogTargetGroup.addTarget(unityCatalogService);

    const streamlitService = new ecs.FargateService(this, 'StreamlitService', {
      cluster: ecsCluster,
      taskDefinition: streamlitTaskDefinition,
      serviceName: 'streamlit-app-service',
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: false,
      vpcSubnets: {
        subnets: networkOutputs.privateSubnets,
      },
      securityGroups: [networkOutputs.ecsSecurityGroup],
    });

    // Register Streamlit service with target group
    streamlitTargetGroup.addTarget(streamlitService);

    // Make Streamlit depend on Unity Catalog being healthy
    streamlitService.node.addDependency(unityCatalogService);

    // Store outputs
    this.outputs = {
      ecsClusterName: ecsCluster.clusterName,
      streamlitEcrRepositoryUri: 'CDK-managed',
      unityCatalogServiceName: unityCatalogService.serviceName,
      streamlitServiceName: streamlitService.serviceName,
    };

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
      exportName: `${this.stackName}-AlbDnsName`,
    });

    new cdk.CfnOutput(this, 'ApplicationUrl', {
      value: `http://${this.alb.loadBalancerDnsName}:443`,
      description: 'Application URL (with Cognito auth)',
      exportName: `${this.stackName}-ApplicationUrl`,
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-CognitoUserPoolId`,
    });

    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: ecsCluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: `${this.stackName}-EcsClusterName`,
    });

    new cdk.CfnOutput(this, 'StreamlitImageInfo', {
      value: 'Streamlit Docker image built and managed automatically by CDK',
      description: 'Streamlit Image Build Info',
      exportName: `${this.stackName}-StreamlitImageInfo`,
    });

    new cdk.CfnOutput(this, 'UnityCatalogServiceName', {
      value: unityCatalogService.serviceName,
      description: 'Unity Catalog ECS Service Name',
      exportName: `${this.stackName}-UnityCatalogServiceName`,
    });

    new cdk.CfnOutput(this, 'StreamlitServiceName', {
      value: streamlitService.serviceName,
      description: 'Streamlit ECS Service Name',
      exportName: `${this.stackName}-StreamlitServiceName`,
    });

    // Add tags
    cdk.Tags.of(this).add('Project', 'catalog-agents-demo');
    cdk.Tags.of(this).add('Environment', 'dev');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
