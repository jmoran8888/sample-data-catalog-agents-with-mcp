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
exports.ComputeStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ecr_assets = __importStar(require("aws-cdk-lib/aws-ecr-assets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const actions = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2-actions"));
const path = __importStar(require("path"));
class ComputeStack extends cdk.Stack {
    outputs;
    alb;
    constructor(scope, id, props) {
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
                iam.ManagedPolicy.fromManagedPolicyArn(this, 'EcsTaskExecutionPolicy', 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'),
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
                UNITY_CATALOG_DB_USER: ecs.Secret.fromSecretsManager(dataOutputs.rdsSecret, 'username'),
                UNITY_CATALOG_DB_PASSWORD: ecs.Secret.fromSecretsManager(dataOutputs.rdsSecret, 'password'),
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
        // Build Docker image using DockerImageAsset for better control
        const streamlitImage = new ecr_assets.DockerImageAsset(this, 'StreamlitImage', {
            directory: path.resolve(__dirname, '../..'),
            file: 'Dockerfile.streamlit',
            platform: ecr_assets.Platform.LINUX_AMD64,
        });
        const streamlitContainer = streamlitTaskDefinition.addContainer('streamlit-app', {
            image: ecs.ContainerImage.fromDockerImageAsset(streamlitImage),
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
                    `https://${this.alb.loadBalancerDnsName}/oauth2/idpresponse`,
                ],
                logoutUrls: [
                    `https://${this.alb.loadBalancerDnsName}/`,
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
exports.ComputeStack = ComputeStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbXB1dGUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBRW5DLHlEQUEyQztBQUUzQyx1RUFBeUQ7QUFDekQseURBQTJDO0FBQzNDLDJEQUE2QztBQUM3Qyw4RUFBZ0U7QUFDaEUsaUVBQW1EO0FBQ25ELHdGQUEwRTtBQUMxRSwyQ0FBNkI7QUFXN0IsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDekIsT0FBTyxDQUFzQjtJQUM3QixHQUFHLENBQWdDO0lBRW5ELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFDOUMsTUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBQUMsaUJBQWlCLElBQUksa0NBQWtDLENBQUM7UUFDeEYsTUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBQUMsaUJBQWlCLElBQUksUUFBUSxDQUFDO1FBRTlELGlEQUFpRDtRQUNqRCxjQUFjO1FBQ2QsaURBQWlEO1FBRWpELE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDL0QsV0FBVyxFQUFFLHdCQUF3QjtZQUNyQyxHQUFHLEVBQUUsY0FBYyxDQUFDLEdBQUc7WUFDdkIsbUZBQW1GO1lBQ25GLGlCQUFpQixFQUFFLElBQUk7U0FDeEIsQ0FBQyxDQUFDO1FBRUgsaURBQWlEO1FBQ2pELFlBQVk7UUFDWixpREFBaUQ7UUFFakQsMEJBQTBCO1FBQzFCLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxt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SUFBSSxDQUFDLFNBQVMsMEJBQTBCO1NBQ3hELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUMsS0FBSyxFQUFFLGdCQUFnQixDQUFDLFdBQVc7WUFDbkMsV0FBVyxFQUFFLDRCQUE0QjtZQUN6QyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyx1QkFBdUI7U0FDckQsQ0FBQyxDQUFDO1FBRUgsV0FBVztRQUNYLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUscUJBQXFCLENBQUMsQ0FBQztRQUN4RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNGO0FBemJELG9DQXliQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGVjcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNzJztcbmltcG9ydCAqIGFzIGVjciBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNyJztcbmltcG9ydCAqIGFzIGVjcl9hc3NldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjci1hc3NldHMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBlbGJ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2xvYWRiYWxhbmNpbmd2Mic7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGFjdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNsb2FkYmFsYW5jaW5ndjItYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgTmV0d29ya1N0YWNrT3V0cHV0cywgRGF0YVN0YWNrT3V0cHV0cywgQ29tcHV0ZVN0YWNrT3V0cHV0cyB9IGZyb20gJy4vdHlwZXMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbXB1dGVTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBuZXR3b3JrT3V0cHV0czogTmV0d29ya1N0YWNrT3V0cHV0cztcbiAgZGF0YU91dHB1dHM6IERhdGFTdGFja091dHB1dHM7XG4gIHVuaXR5Q2F0YWxvZ0ltYWdlPzogc3RyaW5nO1xuICBzdHJlYW1saXRJbWFnZVRhZz86IHN0cmluZztcbiAgYWRtaW5FbWFpbD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIENvbXB1dGVTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBvdXRwdXRzOiBDb21wdXRlU3RhY2tPdXRwdXRzO1xuICBwdWJsaWMgcmVhZG9ubHkgYWxiOiBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQ29tcHV0ZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgbmV0d29ya091dHB1dHMsIGRhdGFPdXRwdXRzIH0gPSBwcm9wcztcbiAgICBjb25zdCB1bml0eUNhdGFsb2dJbWFnZSA9IHByb3BzLnVuaXR5Q2F0YWxvZ0ltYWdlIHx8ICd1bml0eWNhdGFsb2cvdW5pdHljYXRhbG9nOmxhdGVzdCc7XG4gICAgY29uc3Qgc3RyZWFtbGl0SW1hZ2VUYWcgPSBwcm9wcy5zdHJlYW1saXRJbWFnZVRhZyB8fCAnbGF0ZXN0JztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBFQ1MgQ2x1c3RlclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IGVjc0NsdXN0ZXIgPSBuZXcgZWNzLkNsdXN0ZXIodGhpcywgJ0NhdGFsb2dBZ2VudHNDbHVzdGVyJywge1xuICAgICAgY2x1c3Rlck5hbWU6ICdjYXRhbG9nLWFnZW50cy1jbHVzdGVyJyxcbiAgICAgIHZwYzogbmV0d29ya091dHB1dHMudnBjLFxuICAgICAgLy8gVXNpbmcgZGVwcmVjYXRlZCBjb250YWluZXJJbnNpZ2h0cyBmb3Igbm93ICh2MiByZXF1aXJlcyBkaWZmZXJlbnQgY29uZmlndXJhdGlvbilcbiAgICAgIGNvbnRhaW5lckluc2lnaHRzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIElBTSBSb2xlc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIEVDUyBUYXNrIEV4ZWN1dGlvbiBSb2xlXG4gICAgY29uc3QgdGFza0V4ZWN1dGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1Rhc2tFeGVjdXRpb25Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Vjcy10YXNrcy5hbWF6b25hd3MuY29tJyksXG4gICAgICByb2xlTmFtZTogJ2NhdGFsb2ctYWdlbnRzLWVjcy10YXNrLWV4ZWN1dGlvbi1yb2xlJyxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tTWFuYWdlZFBvbGljeUFybihcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgICdFY3NUYXNrRXhlY3V0aW9uUG9saWN5JyxcbiAgICAgICAgICAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvc2VydmljZS1yb2xlL0FtYXpvbkVDU1Rhc2tFeGVjdXRpb25Sb2xlUG9saWN5J1xuICAgICAgICApLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IGFjY2VzcyB0byBSRFMgc2VjcmV0XG4gICAgZGF0YU91dHB1dHMucmRzU2VjcmV0LmdyYW50UmVhZCh0YXNrRXhlY3V0aW9uUm9sZSk7XG5cbiAgICAvLyBFQ1MgVGFzayBSb2xlIChmb3IgdGFza3MgdG8gYWNjZXNzIEFXUyBzZXJ2aWNlcylcbiAgICBjb25zdCB0YXNrUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnVGFza1JvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZWNzLXRhc2tzLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHJvbGVOYW1lOiAnY2F0YWxvZy1hZ2VudHMtZWNzLXRhc2stcm9sZScsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBHbHVlIHBlcm1pc3Npb25zIHRvIHRhc2sgcm9sZVxuICAgIHRhc2tSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2dsdWU6R2V0RGF0YWJhc2UnLFxuICAgICAgICAnZ2x1ZTpHZXREYXRhYmFzZXMnLFxuICAgICAgICAnZ2x1ZTpHZXRUYWJsZScsXG4gICAgICAgICdnbHVlOkdldFRhYmxlcycsXG4gICAgICAgICdnbHVlOkdldFBhcnRpdGlvbicsXG4gICAgICAgICdnbHVlOkdldFBhcnRpdGlvbnMnLFxuICAgICAgICAnZ2x1ZTpTZWFyY2hUYWJsZXMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gR3JhbnQgQmVkcm9jayBwZXJtaXNzaW9ucyB0byB0YXNrIHJvbGVcbiAgICB0YXNrUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICAnYXJuOmF3czpiZWRyb2NrOio6KjppbmZlcmVuY2UtcHJvZmlsZS8qJyxcbiAgICAgICAgJ2Fybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLyonLFxuICAgICAgXSxcbiAgICB9KSk7XG5cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDbG91ZFdhdGNoIExvZyBHcm91cHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBjb25zdCB1bml0eUNhdGFsb2dMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdVbml0eUNhdGFsb2dMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9lY3MvdW5pdHktY2F0YWxvZycsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICBjb25zdCBzdHJlYW1saXRMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdTdHJlYW1saXRMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9lY3Mvc3RyZWFtbGl0LWFwcCcsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gVW5pdHkgQ2F0YWxvZyBUYXNrIERlZmluaXRpb25cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBjb25zdCB1bml0eUNhdGFsb2dUYXNrRGVmaW5pdGlvbiA9IG5ldyBlY3MuRmFyZ2F0ZVRhc2tEZWZpbml0aW9uKHRoaXMsICdVbml0eUNhdGFsb2dUYXNrRGVmJywge1xuICAgICAgZmFtaWx5OiAndW5pdHktY2F0YWxvZycsXG4gICAgICBjcHU6IDEwMjQsXG4gICAgICBtZW1vcnlMaW1pdE1pQjogMjA0OCxcbiAgICAgIGV4ZWN1dGlvblJvbGU6IHRhc2tFeGVjdXRpb25Sb2xlLFxuICAgICAgdGFza1JvbGU6IHRhc2tSb2xlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdW5pdHlDYXRhbG9nQ29udGFpbmVyID0gdW5pdHlDYXRhbG9nVGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKCd1bml0eS1jYXRhbG9nJywge1xuICAgICAgaW1hZ2U6IGVjcy5Db250YWluZXJJbWFnZS5mcm9tUmVnaXN0cnkodW5pdHlDYXRhbG9nSW1hZ2UpLFxuICAgICAgbG9nZ2luZzogZWNzLkxvZ0RyaXZlcnMuYXdzTG9ncyh7XG4gICAgICAgIHN0cmVhbVByZWZpeDogJ2VjcycsXG4gICAgICAgIGxvZ0dyb3VwOiB1bml0eUNhdGFsb2dMb2dHcm91cCxcbiAgICAgIH0pLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVU5JVFlfQ0FUQUxPR19EQl9VUkw6IGBqZGJjOnBvc3RncmVzcWw6Ly8ke2RhdGFPdXRwdXRzLnJkc0NsdXN0ZXIuY2x1c3RlckVuZHBvaW50Lmhvc3RuYW1lfTo1NDMyL3VuaXR5Y2F0YWxvZ2AsXG4gICAgICB9LFxuICAgICAgc2VjcmV0czoge1xuICAgICAgICBVTklUWV9DQVRBTE9HX0RCX1VTRVI6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKFxuICAgICAgICAgIGRhdGFPdXRwdXRzLnJkc1NlY3JldCxcbiAgICAgICAgICAndXNlcm5hbWUnXG4gICAgICAgICksXG4gICAgICAgIFVOSVRZX0NBVEFMT0dfREJfUEFTU1dPUkQ6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKFxuICAgICAgICAgIGRhdGFPdXRwdXRzLnJkc1NlY3JldCxcbiAgICAgICAgICAncGFzc3dvcmQnXG4gICAgICAgICksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdW5pdHlDYXRhbG9nQ29udGFpbmVyLmFkZFBvcnRNYXBwaW5ncyh7XG4gICAgICBjb250YWluZXJQb3J0OiA4MDgwLFxuICAgICAgcHJvdG9jb2w6IGVjcy5Qcm90b2NvbC5UQ1AsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU3RyZWFtbGl0IFRhc2sgRGVmaW5pdGlvblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IHN0cmVhbWxpdFRhc2tEZWZpbml0aW9uID0gbmV3IGVjcy5GYXJnYXRlVGFza0RlZmluaXRpb24odGhpcywgJ1N0cmVhbWxpdFRhc2tEZWYnLCB7XG4gICAgICBmYW1pbHk6ICdzdHJlYW1saXQtYXBwJyxcbiAgICAgIGNwdTogNTEyLFxuICAgICAgbWVtb3J5TGltaXRNaUI6IDEwMjQsXG4gICAgICBleGVjdXRpb25Sb2xlOiB0YXNrRXhlY3V0aW9uUm9sZSxcbiAgICAgIHRhc2tSb2xlOiB0YXNrUm9sZSxcbiAgICB9KTtcblxuICAgIC8vIEJ1aWxkIERvY2tlciBpbWFnZSB1c2luZyBEb2NrZXJJbWFnZUFzc2V0IGZvciBiZXR0ZXIgY29udHJvbFxuICAgIGNvbnN0IHN0cmVhbWxpdEltYWdlID0gbmV3IGVjcl9hc3NldHMuRG9ja2VySW1hZ2VBc3NldCh0aGlzLCAnU3RyZWFtbGl0SW1hZ2UnLCB7XG4gICAgICBkaXJlY3Rvcnk6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLicpLFxuICAgICAgZmlsZTogJ0RvY2tlcmZpbGUuc3RyZWFtbGl0JyxcbiAgICAgIHBsYXRmb3JtOiBlY3JfYXNzZXRzLlBsYXRmb3JtLkxJTlVYX0FNRDY0LFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3RyZWFtbGl0Q29udGFpbmVyID0gc3RyZWFtbGl0VGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKCdzdHJlYW1saXQtYXBwJywge1xuICAgICAgaW1hZ2U6IGVjcy5Db250YWluZXJJbWFnZS5mcm9tRG9ja2VySW1hZ2VBc3NldChzdHJlYW1saXRJbWFnZSksXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHtcbiAgICAgICAgc3RyZWFtUHJlZml4OiAnZWNzJyxcbiAgICAgICAgbG9nR3JvdXA6IHN0cmVhbWxpdExvZ0dyb3VwLFxuICAgICAgfSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAvLyBXaWxsIGJlIHVwZGF0ZWQgd2l0aCBBTEIgRE5TIGFmdGVyIEZyb250ZW5kU3RhY2sgaXMgY3JlYXRlZFxuICAgICAgICBVTklUWV9DQVRBTE9HX1VSTDogJ2h0dHA6Ly91bml0eS1jYXRhbG9nLmxvY2FsOjgwODAvYXBpLzIuMS91bml0eS1jYXRhbG9nJyxcbiAgICAgICAgQVdTX0RFRkFVTFRfUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBzdHJlYW1saXRDb250YWluZXIuYWRkUG9ydE1hcHBpbmdzKHtcbiAgICAgIGNvbnRhaW5lclBvcnQ6IDg1MDEsXG4gICAgICBwcm90b2NvbDogZWNzLlByb3RvY29sLlRDUCxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgdGhpcy5hbGIgPSBuZXcgZWxidjIuQXBwbGljYXRpb25Mb2FkQmFsYW5jZXIodGhpcywgJ0NhdGFsb2dBZ2VudHNBTEInLCB7XG4gICAgICB2cGM6IG5ldHdvcmtPdXRwdXRzLnZwYyxcbiAgICAgIGludGVybmV0RmFjaW5nOiB0cnVlLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRzOiBuZXR3b3JrT3V0cHV0cy5wdWJsaWNTdWJuZXRzLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IG5ldHdvcmtPdXRwdXRzLmFsYlNlY3VyaXR5R3JvdXAsXG4gICAgICBsb2FkQmFsYW5jZXJOYW1lOiAnY2F0YWxvZy1hZ2VudHMtYWxiJyxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gVGFyZ2V0IEdyb3Vwc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IHVuaXR5Q2F0YWxvZ1RhcmdldEdyb3VwID0gbmV3IGVsYnYyLkFwcGxpY2F0aW9uVGFyZ2V0R3JvdXAodGhpcywgJ1VuaXR5Q2F0YWxvZ1RhcmdldEdyb3VwJywge1xuICAgICAgdnBjOiBuZXR3b3JrT3V0cHV0cy52cGMsXG4gICAgICBwb3J0OiA4MDgwLFxuICAgICAgcHJvdG9jb2w6IGVsYnYyLkFwcGxpY2F0aW9uUHJvdG9jb2wuSFRUUCxcbiAgICAgIHRhcmdldFR5cGU6IGVsYnYyLlRhcmdldFR5cGUuSVAsXG4gICAgICBoZWFsdGhDaGVjazoge1xuICAgICAgICBwYXRoOiAnL2FwaS8yLjEvdW5pdHktY2F0YWxvZy9jYXRhbG9ncycsXG4gICAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDUpLFxuICAgICAgICBoZWFsdGh5VGhyZXNob2xkQ291bnQ6IDIsXG4gICAgICAgIHVuaGVhbHRoeVRocmVzaG9sZENvdW50OiAzLFxuICAgICAgfSxcbiAgICAgIGRlcmVnaXN0cmF0aW9uRGVsYXk6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHN0cmVhbWxpdFRhcmdldEdyb3VwID0gbmV3IGVsYnYyLkFwcGxpY2F0aW9uVGFyZ2V0R3JvdXAodGhpcywgJ1N0cmVhbWxpdFRhcmdldEdyb3VwJywge1xuICAgICAgdnBjOiBuZXR3b3JrT3V0cHV0cy52cGMsXG4gICAgICBwb3J0OiA4NTAxLFxuICAgICAgcHJvdG9jb2w6IGVsYnYyLkFwcGxpY2F0aW9uUHJvdG9jb2wuSFRUUCxcbiAgICAgIHRhcmdldFR5cGU6IGVsYnYyLlRhcmdldFR5cGUuSVAsXG4gICAgICBoZWFsdGhDaGVjazoge1xuICAgICAgICBwYXRoOiAnLycsXG4gICAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDUpLFxuICAgICAgICBoZWFsdGh5VGhyZXNob2xkQ291bnQ6IDIsXG4gICAgICAgIHVuaGVhbHRoeVRocmVzaG9sZENvdW50OiAzLFxuICAgICAgfSxcbiAgICAgIGRlcmVnaXN0cmF0aW9uRGVsYXk6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbCAoZm9yIEF1dGhlbnRpY2F0aW9uKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ0NhdGFsb2dBZ2VudHNVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ2NhdGFsb2ctYWdlbnRzLXVzZXJzJyxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogZmFsc2UsXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDb2duaXRvIFVzZXIgUG9vbCBEb21haW5cbiAgICBjb25zdCB1c2VyUG9vbERvbWFpbiA9IG5ldyBjb2duaXRvLlVzZXJQb29sRG9tYWluKHRoaXMsICdDYXRhbG9nQWdlbnRzVXNlclBvb2xEb21haW4nLCB7XG4gICAgICB1c2VyUG9vbCxcbiAgICAgIGNvZ25pdG9Eb21haW46IHtcbiAgICAgICAgZG9tYWluUHJlZml4OiBgY2F0YWxvZy1hZ2VudHMtJHt0aGlzLmFjY291bnQuc3Vic3RyaW5nKDAsIDgpfWAsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENvZ25pdG8gVXNlciBQb29sIENsaWVudFxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ0NhdGFsb2dBZ2VudHNVc2VyUG9vbENsaWVudCcsIHtcbiAgICAgIHVzZXJQb29sLFxuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiAnY2F0YWxvZy1hZ2VudHMtY2xpZW50JyxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiB0cnVlLFxuICAgICAgb0F1dGg6IHtcbiAgICAgICAgZmxvd3M6IHtcbiAgICAgICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBzY29wZXM6IFtcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRSxcbiAgICAgICAgXSxcbiAgICAgICAgY2FsbGJhY2tVcmxzOiBbXG4gICAgICAgICAgYGh0dHBzOi8vJHt0aGlzLmFsYi5sb2FkQmFsYW5jZXJEbnNOYW1lfS9vYXV0aDIvaWRwcmVzcG9uc2VgLFxuICAgICAgICBdLFxuICAgICAgICBsb2dvdXRVcmxzOiBbXG4gICAgICAgICAgYGh0dHBzOi8vJHt0aGlzLmFsYi5sb2FkQmFsYW5jZXJEbnNOYW1lfS9gLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHN1cHBvcnRlZElkZW50aXR5UHJvdmlkZXJzOiBbXG4gICAgICAgIGNvZ25pdG8uVXNlclBvb2xDbGllbnRJZGVudGl0eVByb3ZpZGVyLkNPR05JVE8sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gT3B0aW9uYWw6IENyZWF0ZSBhZG1pbiB1c2VyIGlmIGVtYWlsIHByb3ZpZGVkXG4gICAgaWYgKHByb3BzLmFkbWluRW1haWwpIHtcbiAgICAgIG5ldyBjb2duaXRvLkNmblVzZXJQb29sVXNlcih0aGlzLCAnQWRtaW5Vc2VyJywge1xuICAgICAgICB1c2VyUG9vbElkOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICB1c2VybmFtZTogcHJvcHMuYWRtaW5FbWFpbCxcbiAgICAgICAgdXNlckF0dHJpYnV0ZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZW1haWwnLFxuICAgICAgICAgICAgdmFsdWU6IHByb3BzLmFkbWluRW1haWwsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnZW1haWxfdmVyaWZpZWQnLFxuICAgICAgICAgICAgdmFsdWU6ICd0cnVlJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBtZXNzYWdlQWN0aW9uOiAnU1VQUFJFU1MnLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEFMQiBMaXN0ZW5lcnMgd2l0aCBDb2duaXRvIEF1dGhlbnRpY2F0aW9uXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gSFRUUCBsaXN0ZW5lciAtIGZvcndhcmQgdG8gcG9ydCA0NDNcbiAgICBjb25zdCBodHRwTGlzdGVuZXIgPSB0aGlzLmFsYi5hZGRMaXN0ZW5lcignSHR0cExpc3RlbmVyJywge1xuICAgICAgcG9ydDogODAsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgZGVmYXVsdEFjdGlvbjogZWxidjIuTGlzdGVuZXJBY3Rpb24ucmVkaXJlY3Qoe1xuICAgICAgICBwb3J0OiAnNDQzJyxcbiAgICAgICAgcHJvdG9jb2w6ICdIVFRQJyxcbiAgICAgICAgcGVybWFuZW50OiB0cnVlLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyBIVFRQIGxpc3RlbmVyIG9uIDQ0MyB3aXRoIENvZ25pdG8gYXV0aGVudGljYXRpb25cbiAgICBjb25zdCBodHRwc0xpc3RlbmVyID0gdGhpcy5hbGIuYWRkTGlzdGVuZXIoJ0h0dHBzTGlzdGVuZXInLCB7XG4gICAgICBwb3J0OiA0NDMsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgZGVmYXVsdEFjdGlvbjogbmV3IGFjdGlvbnMuQXV0aGVudGljYXRlQ29nbml0b0FjdGlvbih7XG4gICAgICAgIHVzZXJQb29sLFxuICAgICAgICB1c2VyUG9vbENsaWVudCxcbiAgICAgICAgdXNlclBvb2xEb21haW4sXG4gICAgICAgIG5leHQ6IGVsYnYyLkxpc3RlbmVyQWN0aW9uLmZvcndhcmQoW3N0cmVhbWxpdFRhcmdldEdyb3VwXSksXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCByb3V0aW5nIHJ1bGUgZm9yIFVuaXR5IENhdGFsb2cgd2l0aCBDb2duaXRvIGF1dGhcbiAgICBodHRwc0xpc3RlbmVyLmFkZEFjdGlvbignVW5pdHlDYXRhbG9nQWN0aW9uJywge1xuICAgICAgcHJpb3JpdHk6IDEwMCxcbiAgICAgIGNvbmRpdGlvbnM6IFtcbiAgICAgICAgZWxidjIuTGlzdGVuZXJDb25kaXRpb24ucGF0aFBhdHRlcm5zKFtcbiAgICAgICAgICAnL2FwaS8qJyxcbiAgICAgICAgICAnL2RvY3MvKicsXG4gICAgICAgICAgJy9vcGVuYXBpLmpzb24nLFxuICAgICAgICBdKSxcbiAgICAgIF0sXG4gICAgICBhY3Rpb246IG5ldyBhY3Rpb25zLkF1dGhlbnRpY2F0ZUNvZ25pdG9BY3Rpb24oe1xuICAgICAgICB1c2VyUG9vbCxcbiAgICAgICAgdXNlclBvb2xDbGllbnQsXG4gICAgICAgIHVzZXJQb29sRG9tYWluLFxuICAgICAgICBuZXh0OiBlbGJ2Mi5MaXN0ZW5lckFjdGlvbi5mb3J3YXJkKFt1bml0eUNhdGFsb2dUYXJnZXRHcm91cF0pLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gRUNTIFNlcnZpY2VzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY29uc3QgdW5pdHlDYXRhbG9nU2VydmljZSA9IG5ldyBlY3MuRmFyZ2F0ZVNlcnZpY2UodGhpcywgJ1VuaXR5Q2F0YWxvZ1NlcnZpY2UnLCB7XG4gICAgICBjbHVzdGVyOiBlY3NDbHVzdGVyLFxuICAgICAgdGFza0RlZmluaXRpb246IHVuaXR5Q2F0YWxvZ1Rhc2tEZWZpbml0aW9uLFxuICAgICAgc2VydmljZU5hbWU6ICd1bml0eS1jYXRhbG9nLXNlcnZpY2UnLFxuICAgICAgZGVzaXJlZENvdW50OiAxLFxuICAgICAgbWluSGVhbHRoeVBlcmNlbnQ6IDEwMCxcbiAgICAgIG1heEhlYWx0aHlQZXJjZW50OiAyMDAsXG4gICAgICBhc3NpZ25QdWJsaWNJcDogZmFsc2UsXG4gICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgIHN1Ym5ldHM6IG5ldHdvcmtPdXRwdXRzLnByaXZhdGVTdWJuZXRzLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbbmV0d29ya091dHB1dHMuZWNzU2VjdXJpdHlHcm91cF0sXG4gICAgfSk7XG5cbiAgICAvLyBSZWdpc3RlciBVbml0eSBDYXRhbG9nIHNlcnZpY2Ugd2l0aCB0YXJnZXQgZ3JvdXBcbiAgICB1bml0eUNhdGFsb2dUYXJnZXRHcm91cC5hZGRUYXJnZXQodW5pdHlDYXRhbG9nU2VydmljZSk7XG5cbiAgICBjb25zdCBzdHJlYW1saXRTZXJ2aWNlID0gbmV3IGVjcy5GYXJnYXRlU2VydmljZSh0aGlzLCAnU3RyZWFtbGl0U2VydmljZScsIHtcbiAgICAgIGNsdXN0ZXI6IGVjc0NsdXN0ZXIsXG4gICAgICB0YXNrRGVmaW5pdGlvbjogc3RyZWFtbGl0VGFza0RlZmluaXRpb24sXG4gICAgICBzZXJ2aWNlTmFtZTogJ3N0cmVhbWxpdC1hcHAtc2VydmljZScsXG4gICAgICBkZXNpcmVkQ291bnQ6IDEsXG4gICAgICBtaW5IZWFsdGh5UGVyY2VudDogMTAwLFxuICAgICAgbWF4SGVhbHRoeVBlcmNlbnQ6IDIwMCxcbiAgICAgIGFzc2lnblB1YmxpY0lwOiBmYWxzZSxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0czogbmV0d29ya091dHB1dHMucHJpdmF0ZVN1Ym5ldHMsXG4gICAgICB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtuZXR3b3JrT3V0cHV0cy5lY3NTZWN1cml0eUdyb3VwXSxcbiAgICB9KTtcblxuICAgIC8vIFJlZ2lzdGVyIFN0cmVhbWxpdCBzZXJ2aWNlIHdpdGggdGFyZ2V0IGdyb3VwXG4gICAgc3RyZWFtbGl0VGFyZ2V0R3JvdXAuYWRkVGFyZ2V0KHN0cmVhbWxpdFNlcnZpY2UpO1xuXG4gICAgLy8gTWFrZSBTdHJlYW1saXQgZGVwZW5kIG9uIFVuaXR5IENhdGFsb2cgYmVpbmcgaGVhbHRoeVxuICAgIHN0cmVhbWxpdFNlcnZpY2Uubm9kZS5hZGREZXBlbmRlbmN5KHVuaXR5Q2F0YWxvZ1NlcnZpY2UpO1xuXG4gICAgLy8gU3RvcmUgb3V0cHV0c1xuICAgIHRoaXMub3V0cHV0cyA9IHtcbiAgICAgIGVjc0NsdXN0ZXJOYW1lOiBlY3NDbHVzdGVyLmNsdXN0ZXJOYW1lLFxuICAgICAgc3RyZWFtbGl0RWNyUmVwb3NpdG9yeVVyaTogJ0NESy1tYW5hZ2VkJyxcbiAgICAgIHVuaXR5Q2F0YWxvZ1NlcnZpY2VOYW1lOiB1bml0eUNhdGFsb2dTZXJ2aWNlLnNlcnZpY2VOYW1lLFxuICAgICAgc3RyZWFtbGl0U2VydmljZU5hbWU6IHN0cmVhbWxpdFNlcnZpY2Uuc2VydmljZU5hbWUsXG4gICAgfTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9uIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxiRG5zTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFsYi5sb2FkQmFsYW5jZXJEbnNOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyIEROUyBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BbGJEbnNOYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcHBsaWNhdGlvblVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cDovLyR7dGhpcy5hbGIubG9hZEJhbGFuY2VyRG5zTmFtZX06NDQzYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXBwbGljYXRpb24gVVJMICh3aXRoIENvZ25pdG8gYXV0aCknLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFwcGxpY2F0aW9uVXJsYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb2duaXRvVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQ29nbml0b1VzZXJQb29sSWRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Vjc0NsdXN0ZXJOYW1lJywge1xuICAgICAgdmFsdWU6IGVjc0NsdXN0ZXIuY2x1c3Rlck5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VDUyBDbHVzdGVyIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUVjc0NsdXN0ZXJOYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdHJlYW1saXRJbWFnZUluZm8nLCB7XG4gICAgICB2YWx1ZTogJ1N0cmVhbWxpdCBEb2NrZXIgaW1hZ2UgYnVpbHQgYW5kIG1hbmFnZWQgYXV0b21hdGljYWxseSBieSBDREsnLFxuICAgICAgZGVzY3JpcHRpb246ICdTdHJlYW1saXQgSW1hZ2UgQnVpbGQgSW5mbycsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tU3RyZWFtbGl0SW1hZ2VJbmZvYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVbml0eUNhdGFsb2dTZXJ2aWNlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB1bml0eUNhdGFsb2dTZXJ2aWNlLnNlcnZpY2VOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdVbml0eSBDYXRhbG9nIEVDUyBTZXJ2aWNlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVuaXR5Q2F0YWxvZ1NlcnZpY2VOYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdHJlYW1saXRTZXJ2aWNlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBzdHJlYW1saXRTZXJ2aWNlLnNlcnZpY2VOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTdHJlYW1saXQgRUNTIFNlcnZpY2UgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tU3RyZWFtbGl0U2VydmljZU5hbWVgLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHRhZ3NcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnY2F0YWxvZy1hZ2VudHMtZGVtbycpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCAnZGV2Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gIH1cbn1cbiJdfQ==