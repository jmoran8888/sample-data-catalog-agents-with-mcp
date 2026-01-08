import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkStackOutputs, DataStackOutputs } from './types';
export interface DataStackProps extends cdk.StackProps {
    networkOutputs: NetworkStackOutputs;
    databaseName?: string;
    databaseUsername?: string;
}
export declare class DataStack extends cdk.Stack {
    readonly outputs: DataStackOutputs;
    constructor(scope: Construct, id: string, props: DataStackProps);
}
