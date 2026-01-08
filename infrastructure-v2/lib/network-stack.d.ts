import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkStackOutputs } from './types';
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
export declare class NetworkStack extends cdk.Stack {
    readonly outputs: NetworkStackOutputs;
    constructor(scope: Construct, id: string, props?: NetworkStackProps);
}
