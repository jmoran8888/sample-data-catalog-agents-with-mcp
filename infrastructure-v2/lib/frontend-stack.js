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
exports.FrontendStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
class FrontendStack extends cdk.Stack {
    outputs;
    constructor(scope, id, props) {
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
exports.FrontendStack = FrontendStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJvbnRlbmQtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJmcm9udGVuZC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFHbkMsaUVBQW1EO0FBV25ELE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFCLE9BQU8sQ0FBdUI7SUFFOUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF5QjtRQUNqRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXRCLGlEQUFpRDtRQUNqRCxvQ0FBb0M7UUFDcEMsaURBQWlEO1FBR2pELGlEQUFpRDtRQUNqRCxvQkFBb0I7UUFDcEIsaURBQWlEO1FBRWpELE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDbkUsWUFBWSxFQUFFLHNCQUFzQjtZQUNwQyxhQUFhLEVBQUU7Z0JBQ2IsS0FBSyxFQUFFLElBQUk7YUFDWjtZQUNELFVBQVUsRUFBRTtnQkFDVixLQUFLLEVBQUUsSUFBSTthQUNaO1lBQ0QsaUJBQWlCLEVBQUUsS0FBSztZQUN4QixjQUFjLEVBQUU7Z0JBQ2QsU0FBUyxFQUFFLENBQUM7Z0JBQ1osZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsYUFBYSxFQUFFLElBQUk7Z0JBQ25CLGNBQWMsRUFBRSxJQUFJO2FBQ3JCO1lBQ0Qsa0JBQWtCLEVBQUU7Z0JBQ2xCLEtBQUssRUFBRTtvQkFDTCxRQUFRLEVBQUUsSUFBSTtvQkFDZCxPQUFPLEVBQUUsSUFBSTtpQkFDZDthQUNGO1lBQ0QsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCw0REFBNEQ7UUFDNUQsTUFBTSxjQUFjLEdBQUcsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUNyRixRQUFRO1lBQ1IsYUFBYSxFQUFFO2dCQUNiLFlBQVksRUFBRSxrQkFBa0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO2FBQy9EO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsa0NBQWtDO1FBQ2xDLE1BQU0sY0FBYyxHQUFHLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsNkJBQTZCLEVBQUU7WUFDckYsUUFBUTtZQUNSLGtCQUFrQixFQUFFLHVCQUF1QjtZQUMzQyxjQUFjLEVBQUUsSUFBSTtZQUNwQixLQUFLLEVBQUU7Z0JBQ0wsS0FBSyxFQUFFO29CQUNMLHNCQUFzQixFQUFFLElBQUk7aUJBQzdCO2dCQUNELE1BQU0sRUFBRTtvQkFDTixPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUs7b0JBQ3hCLE9BQU8sQ0FBQyxVQUFVLENBQUMsTUFBTTtvQkFDekIsT0FBTyxDQUFDLFVBQVUsQ0FBQyxPQUFPO2lCQUMzQjtnQkFDRCxZQUFZLEVBQUU7b0JBQ1osV0FBVyxHQUFHLENBQUMsbUJBQW1CLHFCQUFxQjtpQkFDeEQ7Z0JBQ0QsVUFBVSxFQUFFO29CQUNWLFdBQVcsR0FBRyxDQUFDLG1CQUFtQixHQUFHO2lCQUN0QzthQUNGO1lBQ0QsMEJBQTBCLEVBQUU7Z0JBQzFCLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQyxPQUFPO2FBQy9DO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsZ0RBQWdEO1FBQ2hELElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3JCLElBQUksT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO2dCQUM3QyxVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVU7Z0JBQy9CLFFBQVEsRUFBRSxLQUFLLENBQUMsVUFBVTtnQkFDMUIsY0FBYyxFQUFFO29CQUNkO3dCQUNFLElBQUksRUFBRSxPQUFPO3dCQUNiLEtBQUssRUFBRSxLQUFLLENBQUMsVUFBVTtxQkFDeEI7b0JBQ0Q7d0JBQ0UsSUFBSSxFQUFFLGdCQUFnQjt3QkFDdEIsS0FBSyxFQUFFLE1BQU07cUJBQ2Q7aUJBQ0Y7Z0JBQ0QsYUFBYSxFQUFFLFVBQVU7YUFDMUIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELGlEQUFpRDtRQUNqRCx5QkFBeUI7UUFDekIsaURBQWlEO1FBQ2pELCtEQUErRDtRQUMvRCwyRUFBMkU7UUFDM0UsMEZBQTBGO1FBRTFGLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxnQ0FBZ0MsR0FBRyxDQUFDLG1CQUFtQiwwQ0FBMEM7WUFDeEcsV0FBVyxFQUFFLGlDQUFpQztTQUMvQyxDQUFDLENBQUM7UUFHSCxnQkFBZ0I7UUFDaEIsSUFBSSxDQUFDLE9BQU8sR0FBRztZQUNiLFVBQVUsRUFBRSxHQUFHLENBQUMsbUJBQW1CO1lBQ25DLE1BQU0sRUFBRSxHQUFHLENBQUMsZUFBZTtZQUMzQixpQkFBaUIsRUFBRSxRQUFRLENBQUMsVUFBVTtZQUN0QyxrQkFBa0IsRUFBRSxRQUFRLENBQUMsV0FBVztZQUN4QyxXQUFXLEVBQUUsV0FBVyxHQUFHLENBQUMsbUJBQW1CLEVBQUU7U0FDbEQsQ0FBQztRQUVGLHlCQUF5QjtRQUN6QixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNwQyxLQUFLLEVBQUUsR0FBRyxDQUFDLG1CQUFtQjtZQUM5QixXQUFXLEVBQUUsb0NBQW9DO1lBQ2pELFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLGFBQWE7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDaEMsS0FBSyxFQUFFLFdBQVcsR0FBRyxDQUFDLG1CQUFtQixFQUFFO1lBQzNDLFdBQVcsRUFBRSx5QkFBeUI7WUFDdEMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsU0FBUztTQUN2QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxRQUFRLENBQUMsVUFBVTtZQUMxQixXQUFXLEVBQUUsc0JBQXNCO1lBQ25DLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLG9CQUFvQjtTQUNsRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQ2pELEtBQUssRUFBRSxjQUFjLENBQUMsZ0JBQWdCO1lBQ3RDLFdBQVcsRUFBRSw2QkFBNkI7WUFDMUMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsMEJBQTBCO1NBQ3hELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0MsS0FBSyxFQUFFLFdBQVcsY0FBYyxDQUFDLFVBQVUsU0FBUyxJQUFJLENBQUMsTUFBTSxvQkFBb0I7WUFDbkYsV0FBVyxFQUFFLDBCQUEwQjtZQUN2QyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyx3QkFBd0I7U0FDdEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLFdBQVcsR0FBRyxDQUFDLG1CQUFtQixFQUFFO1lBQzNDLFdBQVcsRUFBRSwyQkFBMkI7WUFDeEMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsZUFBZTtTQUM3QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxXQUFXLEdBQUcsQ0FBQyxtQkFBbUIsd0JBQXdCO1lBQ2pFLFdBQVcsRUFBRSx1QkFBdUI7WUFDcEMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsa0JBQWtCO1NBQ2hELENBQUMsQ0FBQztRQUVILFdBQVc7UUFDWCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLHFCQUFxQixDQUFDLENBQUM7UUFDeEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM1QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDN0MsQ0FBQztDQUNGO0FBdEtELHNDQXNLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGVsYnYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lbGFzdGljbG9hZGJhbGFuY2luZ3YyJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgYWNtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXInO1xuaW1wb3J0ICogYXMgYWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2xvYWRiYWxhbmNpbmd2Mi1hY3Rpb25zJztcbmltcG9ydCB7IE5ldHdvcmtTdGFja091dHB1dHMsIENvbXB1dGVTdGFja091dHB1dHMsIEZyb250ZW5kU3RhY2tPdXRwdXRzIH0gZnJvbSAnLi90eXBlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRnJvbnRlbmRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBjb21wdXRlT3V0cHV0czogQ29tcHV0ZVN0YWNrT3V0cHV0cztcbiAgYWxiOiBlbGJ2Mi5JQXBwbGljYXRpb25Mb2FkQmFsYW5jZXI7XG4gIGFkbWluRW1haWw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBGcm9udGVuZFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IG91dHB1dHM6IEZyb250ZW5kU3RhY2tPdXRwdXRzO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBGcm9udGVuZFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgYWxiIH0gPSBwcm9wcztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTZWxmLVNpZ25lZCBDZXJ0aWZpY2F0ZSBmb3IgSFRUUFNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ0NhdGFsb2dBZ2VudHNVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ2NhdGFsb2ctYWdlbnRzLXVzZXJzJyxcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogZmFsc2UsXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xuICAgICAgICBlbWFpbDoge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDb2duaXRvIFVzZXIgUG9vbCBEb21haW4gKG11c3QgYmUgZ2xvYmFsbHkgdW5pcXVlKVxuICAgIGNvbnN0IHVzZXJQb29sRG9tYWluID0gbmV3IGNvZ25pdG8uVXNlclBvb2xEb21haW4odGhpcywgJ0NhdGFsb2dBZ2VudHNVc2VyUG9vbERvbWFpbicsIHtcbiAgICAgIHVzZXJQb29sLFxuICAgICAgY29nbml0b0RvbWFpbjoge1xuICAgICAgICBkb21haW5QcmVmaXg6IGBjYXRhbG9nLWFnZW50cy0ke3RoaXMuYWNjb3VudC5zdWJzdHJpbmcoMCwgOCl9YCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50XG4gICAgY29uc3QgdXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnQ2F0YWxvZ0FnZW50c1VzZXJQb29sQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2wsXG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6ICdjYXRhbG9nLWFnZW50cy1jbGllbnQnLFxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IHRydWUsXG4gICAgICBvQXV0aDoge1xuICAgICAgICBmbG93czoge1xuICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHNjb3BlczogW1xuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuT1BFTklELFxuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5QUk9GSUxFLFxuICAgICAgICBdLFxuICAgICAgICBjYWxsYmFja1VybHM6IFtcbiAgICAgICAgICBgaHR0cHM6Ly8ke2FsYi5sb2FkQmFsYW5jZXJEbnNOYW1lfS9vYXV0aDIvaWRwcmVzcG9uc2VgLFxuICAgICAgICBdLFxuICAgICAgICBsb2dvdXRVcmxzOiBbXG4gICAgICAgICAgYGh0dHBzOi8vJHthbGIubG9hZEJhbGFuY2VyRG5zTmFtZX0vYCxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICBzdXBwb3J0ZWRJZGVudGl0eVByb3ZpZGVyczogW1xuICAgICAgICBjb2duaXRvLlVzZXJQb29sQ2xpZW50SWRlbnRpdHlQcm92aWRlci5DT0dOSVRPLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIE9wdGlvbmFsOiBDcmVhdGUgYWRtaW4gdXNlciBpZiBlbWFpbCBwcm92aWRlZFxuICAgIGlmIChwcm9wcy5hZG1pbkVtYWlsKSB7XG4gICAgICBuZXcgY29nbml0by5DZm5Vc2VyUG9vbFVzZXIodGhpcywgJ0FkbWluVXNlcicsIHtcbiAgICAgICAgdXNlclBvb2xJZDogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgdXNlcm5hbWU6IHByb3BzLmFkbWluRW1haWwsXG4gICAgICAgIHVzZXJBdHRyaWJ1dGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2VtYWlsJyxcbiAgICAgICAgICAgIHZhbHVlOiBwcm9wcy5hZG1pbkVtYWlsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2VtYWlsX3ZlcmlmaWVkJyxcbiAgICAgICAgICAgIHZhbHVlOiAndHJ1ZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbWVzc2FnZUFjdGlvbjogJ1NVUFBSRVNTJyxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBOb3RlIG9uIEF1dGhlbnRpY2F0aW9uXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIENvZ25pdG8gaXMgY3JlYXRlZCBidXQgbm90IHlldCBpbnRlZ3JhdGVkIHdpdGggQUxCIGxpc3RlbmVyc1xuICAgIC8vIFRoZSBBTEIgbGlzdGVuZXJzIGluIENvbXB1dGVTdGFjayBmb3J3YXJkIHRyYWZmaWMgd2l0aG91dCBhdXRoZW50aWNhdGlvblxuICAgIC8vIEZvciBwcm9kdWN0aW9uLCB5b3Ugd291bGQgbmVlZCB0byB1cGRhdGUgdGhlIGxpc3RlbmVycyB0byB1c2UgQXV0aGVudGljYXRlQ29nbml0b0FjdGlvblxuICAgIFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBY2Nlc3NOb3RlJywge1xuICAgICAgdmFsdWU6IGBBY2Nlc3MgYXBwbGljYXRpb24gYXQgaHR0cDovLyR7YWxiLmxvYWRCYWxhbmNlckRuc05hbWV9OjQ0MyAoYXV0aGVudGljYXRpb24gbm90IGNvbmZpZ3VyZWQgeWV0KWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FwcGxpY2F0aW9uIGFjY2VzcyBpbnN0cnVjdGlvbnMnLFxuICAgIH0pO1xuXG5cbiAgICAvLyBTdG9yZSBvdXRwdXRzXG4gICAgdGhpcy5vdXRwdXRzID0ge1xuICAgICAgYWxiRG5zTmFtZTogYWxiLmxvYWRCYWxhbmNlckRuc05hbWUsXG4gICAgICBhbGJBcm46IGFsYi5sb2FkQmFsYW5jZXJBcm4sXG4gICAgICBjb2duaXRvVXNlclBvb2xJZDogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGNvZ25pdG9Vc2VyUG9vbEFybjogdXNlclBvb2wudXNlclBvb2xBcm4sXG4gICAgICBhcGlFbmRwb2ludDogYGh0dHBzOi8vJHthbGIubG9hZEJhbGFuY2VyRG5zTmFtZX1gLFxuICAgIH07XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FsYkRuc05hbWUnLCB7XG4gICAgICB2YWx1ZTogYWxiLmxvYWRCYWxhbmNlckRuc05hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FwcGxpY2F0aW9uIExvYWQgQmFsYW5jZXIgRE5TIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFsYkRuc05hbWVgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FsYlVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke2FsYi5sb2FkQmFsYW5jZXJEbnNOYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FwcGxpY2F0aW9uIFVSTCAoSFRUUFMpJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BbGJVcmxgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvZ25pdG9Vc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Db2duaXRvVXNlclBvb2xJZGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29nbml0b1VzZXJQb29sQ2xpZW50SWQnLCB7XG4gICAgICB2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Db2duaXRvVXNlclBvb2xDbGllbnRJZGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29nbml0b1VzZXJQb29sRG9tYWluJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dXNlclBvb2xEb21haW4uZG9tYWluTmFtZX0uYXV0aC4ke3RoaXMucmVnaW9ufS5hbWF6b25jb2duaXRvLmNvbWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIERvbWFpbicsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQ29nbml0b1VzZXJQb29sRG9tYWluYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdHJlYW1saXRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHthbGIubG9hZEJhbGFuY2VyRG5zTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdTdHJlYW1saXQgQXBwbGljYXRpb24gVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1TdHJlYW1saXRVcmxgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VuaXR5Q2F0YWxvZ1VybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke2FsYi5sb2FkQmFsYW5jZXJEbnNOYW1lfS9hcGkvMi4xL3VuaXR5LWNhdGFsb2dgLFxuICAgICAgZGVzY3JpcHRpb246ICdVbml0eSBDYXRhbG9nIEFQSSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVuaXR5Q2F0YWxvZ1VybGAsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgdGFnc1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdjYXRhbG9nLWFnZW50cy1kZW1vJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsICdkZXYnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ01hbmFnZWRCeScsICdDREsnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0ZJU1RhcmdldCcsICd0cnVlJyk7XG4gIH1cbn1cbiJdfQ==