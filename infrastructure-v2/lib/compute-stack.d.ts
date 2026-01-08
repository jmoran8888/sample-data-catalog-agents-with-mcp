import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { NetworkStackOutputs, DataStackOutputs, ComputeStackOutputs } from './types';
export interface ComputeStackProps extends cdk.StackProps {
    networkOutputs: NetworkStackOutputs;
    dataOutputs: DataStackOutputs;
    unityCatalogImage?: string;
    streamlitImageTag?: string;
    adminEmail?: string;
}
export declare class ComputeStack extends cdk.Stack {
    readonly outputs: ComputeStackOutputs;
    readonly alb: elbv2.ApplicationLoadBalancer;
    constructor(scope: Construct, id: string, props: ComputeStackProps);
}
