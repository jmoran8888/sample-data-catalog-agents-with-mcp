import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ComputeStackOutputs, FrontendStackOutputs } from './types';
export interface FrontendStackProps extends cdk.StackProps {
    computeOutputs: ComputeStackOutputs;
    alb: elbv2.IApplicationLoadBalancer;
    adminEmail?: string;
}
export declare class FrontendStack extends cdk.Stack {
    readonly outputs: FrontendStackOutputs;
    constructor(scope: Construct, id: string, props: FrontendStackProps);
}
