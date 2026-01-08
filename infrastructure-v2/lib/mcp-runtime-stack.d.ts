import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkStackOutputs, FrontendStackOutputs, McpRuntimeStackOutputs } from './types';
export interface McpRuntimeStackProps extends cdk.StackProps {
    networkOutputs: NetworkStackOutputs;
    frontendOutputs: FrontendStackOutputs;
}
export declare class McpRuntimeStack extends cdk.Stack {
    readonly outputs: McpRuntimeStackOutputs;
    constructor(scope: Construct, id: string, props: McpRuntimeStackProps);
}
