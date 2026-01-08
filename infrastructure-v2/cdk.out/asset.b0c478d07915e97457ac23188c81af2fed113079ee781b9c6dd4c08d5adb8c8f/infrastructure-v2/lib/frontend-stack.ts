import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as actions from 'aws-cdk-lib/aws-elasticloadbalancingv2-actions';
import { NetworkStackOutputs, ComputeStackOutputs, FrontendStackOutputs } from './types';

export interface FrontendStackProps extends cdk.StackProps {
  computeOutputs: ComputeStackOutputs;
  alb: elbv2.IApplicationLoadBalancer;
  adminEmail?: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly outputs: FrontendStackOutputs;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { alb } = props;

    // ==============================================
    // Self-Signed Certificate for HTTPS
    // ==============================================


    // ==============================================
    // Cognito User Pool
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

    // Create Cognito User Pool Domain (must be globally unique)
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
          `https://${alb.loadBalancerDnsName}/oauth2/idpresponse`,
        ],
        logoutUrls: [
          `https://${alb.loadBalancerDnsName}/`,
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
    // Note on Authentication
    // ==============================================
    // Cognito is created but not yet integrated with ALB listeners
    // The ALB listeners in ComputeStack forward traffic without authentication
    // For production, you would need to update the listeners to use AuthenticateCognitoAction
    
    new cdk.CfnOutput(this, 'AccessNote', {
      value: `Access application at http://${alb.loadBalancerDnsName}:443 (authentication not configured yet)`,
      description: 'Application access instructions',
    });


    // Store outputs
    this.outputs = {
      albDnsName: alb.loadBalancerDnsName,
      albArn: alb.loadBalancerArn,
      cognitoUserPoolId: userPool.userPoolId,
      cognitoUserPoolArn: userPool.userPoolArn,
      apiEndpoint: `https://${alb.loadBalancerDnsName}`,
    };

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
      exportName: `${this.stackName}-AlbDnsName`,
    });

    new cdk.CfnOutput(this, 'AlbUrl', {
      value: `https://${alb.loadBalancerDnsName}`,
      description: 'Application URL (HTTPS)',
      exportName: `${this.stackName}-AlbUrl`,
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-CognitoUserPoolId`,
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${this.stackName}-CognitoUserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolDomain', {
      value: `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito User Pool Domain',
      exportName: `${this.stackName}-CognitoUserPoolDomain`,
    });

    new cdk.CfnOutput(this, 'StreamlitUrl', {
      value: `https://${alb.loadBalancerDnsName}`,
      description: 'Streamlit Application URL',
      exportName: `${this.stackName}-StreamlitUrl`,
    });

    new cdk.CfnOutput(this, 'UnityCatalogUrl', {
      value: `https://${alb.loadBalancerDnsName}/api/2.1/unity-catalog`,
      description: 'Unity Catalog API URL',
      exportName: `${this.stackName}-UnityCatalogUrl`,
    });

    // Add tags
    cdk.Tags.of(this).add('Project', 'catalog-agents-demo');
    cdk.Tags.of(this).add('Environment', 'dev');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('FISTarget', 'true');
  }
}
