import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { NetworkStackOutputs, DataStackOutputs } from './types';

export interface DataStackProps extends cdk.StackProps {
  networkOutputs: NetworkStackOutputs;
  databaseName?: string;
  databaseUsername?: string;
}

export class DataStack extends cdk.Stack {
  public readonly outputs: DataStackOutputs;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { networkOutputs } = props;
    const databaseName = props.databaseName || 'unitycatalog';
    const databaseUsername = props.databaseUsername || 'unitycatalog';

    // ==============================================
    // RDS Aurora Serverless v2 PostgreSQL
    // ==============================================

    // Create subnet group for RDS
    const dbSubnetGroup = new rds.SubnetGroup(this, 'RdsSubnetGroup', {
      description: 'Subnet group for Unity Catalog RDS',
      vpc: networkOutputs.vpc,
      vpcSubnets: {
        subnets: networkOutputs.privateSubnets,
      },
      subnetGroupName: 'unity-catalog-db-subnet-group',
    });

    // Create RDS cluster with Aurora Serverless v2
    const rdsCluster = new rds.DatabaseCluster(this, 'UnityCatalogCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_8,
      }),
      clusterIdentifier: 'unity-catalog-db',
      defaultDatabaseName: databaseName,
      credentials: rds.Credentials.fromGeneratedSecret(databaseUsername, {
        secretName: `${databaseName}-db-credentials`,
      }),
      vpc: networkOutputs.vpc,
      vpcSubnets: {
        subnets: networkOutputs.privateSubnets,
      },
      securityGroups: [networkOutputs.rdsSecurityGroup],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      storageEncrypted: true,
      backup: {
        retention: cdk.Duration.days(7),
      },
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ==============================================
    // S3 Bucket for Glue Data
    // ==============================================

    const glueDataBucket = new s3.Bucket(this, 'GlueDataBucket', {
      bucketName: `catalog-agents-glue-data-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ==============================================
    // AWS Glue Catalog
    // ==============================================

    // Create Glue Databases
    const customerDatabase = new glue.CfnDatabase(this, 'CustomerDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: 'customer_database',
        description: 'Customer data catalog',
      },
    });

    const salesDatabase = new glue.CfnDatabase(this, 'SalesDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: 'sales_database',
        description: 'Sales data catalog',
      },
    });

    const analyticsDatabase = new glue.CfnDatabase(this, 'AnalyticsDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: 'analytics_database',
        description: 'Analytics data catalog',
      },
    });

    // Create Glue Tables
    // Customer Profile Table
    const customerProfileTable = new glue.CfnTable(this, 'CustomerProfileTable', {
      catalogId: this.account,
      databaseName: customerDatabase.ref,
      tableInput: {
        name: 'customer_profile',
        description: 'Customer profile information',
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          'classification': 'parquet',
          'compressionType': 'none',
        },
        storageDescriptor: {
          location: `s3://${glueDataBucket.bucketName}/customer_profile/`,
          inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
          },
          columns: [
            { name: 'customer_id', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string' },
            { name: 'created_at', type: 'timestamp' },
          ],
        },
      },
    });

    // Customer Orders Table
    const customerOrdersTable = new glue.CfnTable(this, 'CustomerOrdersTable', {
      catalogId: this.account,
      databaseName: salesDatabase.ref,
      tableInput: {
        name: 'customer_orders',
        description: 'Customer order transactions',
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          'classification': 'parquet',
          'compressionType': 'none',
        },
        storageDescriptor: {
          location: `s3://${glueDataBucket.bucketName}/customer_orders/`,
          inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
          },
          columns: [
            { name: 'order_id', type: 'string' },
            { name: 'customer_id', type: 'string' },
            { name: 'product_id', type: 'string' },
            { name: 'quantity', type: 'int' },
            { name: 'amount', type: 'decimal(10,2)' },
            { name: 'order_date', type: 'timestamp' },
          ],
        },
      },
    });

    // Daily Sales Summary Table
    const dailySalesSummaryTable = new glue.CfnTable(this, 'DailySalesSummaryTable', {
      catalogId: this.account,
      databaseName: analyticsDatabase.ref,
      tableInput: {
        name: 'daily_sales_summary',
        description: 'Daily aggregated sales metrics',
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          'classification': 'parquet',
          'compressionType': 'none',
        },
        storageDescriptor: {
          location: `s3://${glueDataBucket.bucketName}/daily_sales_summary/`,
          inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
          },
          columns: [
            { name: 'date', type: 'date' },
            { name: 'total_orders', type: 'int' },
            { name: 'total_revenue', type: 'decimal(12,2)' },
            { name: 'unique_customers', type: 'int' },
          ],
        },
      },
    });

    // Store outputs
    this.outputs = {
      rdsCluster,
      rdsSecret: rdsCluster.secret!,
      rdsSecretArn: rdsCluster.secret!.secretArn,
      glueDatabaseNames: [
        customerDatabase.ref,
        salesDatabase.ref,
        analyticsDatabase.ref,
      ],
      glueDataBucketName: glueDataBucket.bucketName,
    };

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'RdsClusterEndpoint', {
      value: rdsCluster.clusterEndpoint.hostname,
      description: 'RDS Cluster Endpoint',
      exportName: `${this.stackName}-RdsClusterEndpoint`,
    });

    new cdk.CfnOutput(this, 'RdsClusterArn', {
      value: rdsCluster.clusterArn,
      description: 'RDS Cluster ARN',
      exportName: `${this.stackName}-RdsClusterArn`,
    });

    new cdk.CfnOutput(this, 'RdsSecretArn', {
      value: rdsCluster.secret!.secretArn,
      description: 'RDS Credentials Secret ARN',
      exportName: `${this.stackName}-RdsSecretArn`,
    });

    new cdk.CfnOutput(this, 'GlueDataBucketName', {
      value: glueDataBucket.bucketName,
      description: 'S3 Bucket for Glue Data',
      exportName: `${this.stackName}-GlueDataBucketName`,
    });

    new cdk.CfnOutput(this, 'GlueDatabases', {
      value: this.outputs.glueDatabaseNames.join(','),
      description: 'Glue Database Names',
      exportName: `${this.stackName}-GlueDatabases`,
    });

    // Add tags
    cdk.Tags.of(this).add('Project', 'catalog-agents-demo');
    cdk.Tags.of(this).add('Environment', 'dev');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
