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
exports.DataStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const glue = __importStar(require("aws-cdk-lib/aws-glue"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
class DataStack extends cdk.Stack {
    outputs;
    constructor(scope, id, props) {
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
            rdsSecret: rdsCluster.secret,
            rdsSecretArn: rdsCluster.secret.secretArn,
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
            value: rdsCluster.secret.secretArn,
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
exports.DataStack = DataStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRhdGEtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBRW5DLHlEQUEyQztBQUUzQywyREFBNkM7QUFDN0MsdURBQXlDO0FBVXpDLE1BQWEsU0FBVSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3RCLE9BQU8sQ0FBbUI7SUFFMUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFxQjtRQUM3RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsY0FBYyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBQ2pDLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxZQUFZLElBQUksY0FBYyxDQUFDO1FBQzFELE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLGdCQUFnQixJQUFJLGNBQWMsQ0FBQztRQUVsRSxpREFBaUQ7UUFDakQsc0NBQXNDO1FBQ3RDLGlEQUFpRDtRQUVqRCw4QkFBOEI7UUFDOUIsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUNoRSxXQUFXLEVBQUUsb0NBQW9DO1lBQ2pELEdBQUcsRUFBRSxjQUFjLENBQUMsR0FBRztZQUN2QixVQUFVLEVBQUU7Z0JBQ1YsT0FBTyxFQUFFLGNBQWMsQ0FBQyxjQUFjO2FBQ3ZDO1lBQ0QsZUFBZSxFQUFFLCtCQUErQjtTQUNqRCxDQUFDLENBQUM7UUFFSCwrQ0FBK0M7UUFDL0MsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUN0RSxNQUFNLEVBQUUsR0FBRyxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQztnQkFDL0MsT0FBTyxFQUFFLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxRQUFRO2FBQ2xELENBQUM7WUFDRixpQkFBaUIsRUFBRSxrQkFBa0I7WUFDckMsbUJBQW1CLEVBQUUsWUFBWTtZQUNqQyxXQUFXLEVBQUUsR0FBRyxDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDakUsVUFBVSxFQUFFLEdBQUcsWUFBWSxpQkFBaUI7YUFDN0MsQ0FBQztZQUNGLEdBQUcsRUFBRSxjQUFjLENBQUMsR0FBRztZQUN2QixVQUFVLEVBQUU7Z0JBQ1YsT0FBTyxFQUFFLGNBQWMsQ0FBQyxjQUFjO2FBQ3ZDO1lBQ0QsY0FBYyxFQUFFLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDO1lBQ2pELHVCQUF1QixFQUFFLEdBQUc7WUFDNUIsdUJBQXVCLEVBQUUsQ0FBQztZQUMxQixNQUFNLEVBQUUsR0FBRyxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO1lBQ2xELGdCQUFnQixFQUFFLElBQUk7WUFDdEIsTUFBTSxFQUFFO2dCQUNOLFNBQVMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDaEM7WUFDRCxrQkFBa0IsRUFBRSxLQUFLO1lBQ3pCLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsaURBQWlEO1FBQ2pELDBCQUEwQjtRQUMxQixpREFBaUQ7UUFFakQsTUFBTSxjQUFjLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUMzRCxVQUFVLEVBQUUsNEJBQTRCLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNyRSxTQUFTLEVBQUUsSUFBSTtZQUNmLFVBQVUsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVTtZQUMxQyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7U0FDbEQsQ0FBQyxDQUFDO1FBRUgsaURBQWlEO1FBQ2pELG1CQUFtQjtRQUNuQixpREFBaUQ7UUFFakQsd0JBQXdCO1FBQ3hCLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUN0RSxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDdkIsYUFBYSxFQUFFO2dCQUNiLElBQUksRUFBRSxtQkFBbUI7Z0JBQ3pCLFdBQVcsRUFBRSx1QkFBdUI7YUFDckM7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLGFBQWEsR0FBRyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUNoRSxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDdkIsYUFBYSxFQUFFO2dCQUNiLElBQUksRUFBRSxnQkFBZ0I7Z0JBQ3RCLFdBQVcsRUFBRSxvQkFBb0I7YUFDbEM7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLGlCQUFpQixHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDeEUsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPO1lBQ3ZCLGFBQWEsRUFBRTtnQkFDYixJQUFJLEVBQUUsb0JBQW9CO2dCQUMxQixXQUFXLEVBQUUsd0JBQXdCO2FBQ3RDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgscUJBQXFCO1FBQ3JCLHlCQUF5QjtRQUN6QixNQUFNLG9CQUFvQixHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDM0UsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPO1lBQ3ZCLFlBQVksRUFBRSxnQkFBZ0IsQ0FBQyxHQUFHO1lBQ2xDLFVBQVUsRUFBRTtnQkFDVixJQUFJLEVBQUUsa0JBQWtCO2dCQUN4QixXQUFXLEVBQUUsOEJBQThCO2dCQUMzQyxTQUFTLEVBQUUsZ0JBQWdCO2dCQUMzQixVQUFVLEVBQUU7b0JBQ1YsZ0JBQWdCLEVBQUUsU0FBUztvQkFDM0IsaUJBQWlCLEVBQUUsTUFBTTtpQkFDMUI7Z0JBQ0QsaUJBQWlCLEVBQUU7b0JBQ2pCLFFBQVEsRUFBRSxRQUFRLGNBQWMsQ0FBQyxVQUFVLG9CQUFvQjtvQkFDL0QsV0FBVyxFQUFFLCtEQUErRDtvQkFDNUUsWUFBWSxFQUFFLGdFQUFnRTtvQkFDOUUsU0FBUyxFQUFFO3dCQUNULG9CQUFvQixFQUFFLDZEQUE2RDtxQkFDcEY7b0JBQ0QsT0FBTyxFQUFFO3dCQUNQLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO3dCQUN2QyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTt3QkFDaEMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7d0JBQ2pDLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFO3FCQUMxQztpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsd0JBQXdCO1FBQ3hCLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUN6RSxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDdkIsWUFBWSxFQUFFLGFBQWEsQ0FBQyxHQUFHO1lBQy9CLFVBQVUsRUFBRTtnQkFDVixJQUFJLEVBQUUsaUJBQWlCO2dCQUN2QixXQUFXLEVBQUUsNkJBQTZCO2dCQUMxQyxTQUFTLEVBQUUsZ0JBQWdCO2dCQUMzQixVQUFVLEVBQUU7b0JBQ1YsZ0JBQWdCLEVBQUUsU0FBUztvQkFDM0IsaUJBQWlCLEVBQUUsTUFBTTtpQkFDMUI7Z0JBQ0QsaUJBQWlCLEVBQUU7b0JBQ2pCLFFBQVEsRUFBRSxRQUFRLGNBQWMsQ0FBQyxVQUFVLG1CQUFtQjtvQkFDOUQsV0FBVyxFQUFFLCtEQUErRDtvQkFDNUUsWUFBWSxFQUFFLGdFQUFnRTtvQkFDOUUsU0FBUyxFQUFFO3dCQUNULG9CQUFvQixFQUFFLDZEQUE2RDtxQkFDcEY7b0JBQ0QsT0FBTyxFQUFFO3dCQUNQLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO3dCQUNwQyxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTt3QkFDdkMsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7d0JBQ3RDLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFO3dCQUNqQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRTt3QkFDekMsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUU7cUJBQzFDO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCw0QkFBNEI7UUFDNUIsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQy9FLFNBQVMsRUFBRSxJQUFJLENBQUMsT0FBTztZQUN2QixZQUFZLEVBQUUsaUJBQWlCLENBQUMsR0FBRztZQUNuQyxVQUFVLEVBQUU7Z0JBQ1YsSUFBSSxFQUFFLHFCQUFxQjtnQkFDM0IsV0FBVyxFQUFFLGdDQUFnQztnQkFDN0MsU0FBUyxFQUFFLGdCQUFnQjtnQkFDM0IsVUFBVSxFQUFFO29CQUNWLGdCQUFnQixFQUFFLFNBQVM7b0JBQzNCLGlCQUFpQixFQUFFLE1BQU07aUJBQzFCO2dCQUNELGlCQUFpQixFQUFFO29CQUNqQixRQUFRLEVBQUUsUUFBUSxjQUFjLENBQUMsVUFBVSx1QkFBdUI7b0JBQ2xFLFdBQVcsRUFBRSwrREFBK0Q7b0JBQzVFLFlBQVksRUFBRSxnRUFBZ0U7b0JBQzlFLFNBQVMsRUFBRTt3QkFDVCxvQkFBb0IsRUFBRSw2REFBNkQ7cUJBQ3BGO29CQUNELE9BQU8sRUFBRTt3QkFDUCxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRTt3QkFDOUIsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUU7d0JBQ3JDLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFO3dCQUNoRCxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFO3FCQUMxQztpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCO1FBQ2hCLElBQUksQ0FBQyxPQUFPLEdBQUc7WUFDYixVQUFVO1lBQ1YsU0FBUyxFQUFFLFVBQVUsQ0FBQyxNQUFPO1lBQzdCLFlBQVksRUFBRSxVQUFVLENBQUMsTUFBTyxDQUFDLFNBQVM7WUFDMUMsaUJBQWlCLEVBQUU7Z0JBQ2pCLGdCQUFnQixDQUFDLEdBQUc7Z0JBQ3BCLGFBQWEsQ0FBQyxHQUFHO2dCQUNqQixpQkFBaUIsQ0FBQyxHQUFHO2FBQ3RCO1lBQ0Qsa0JBQWtCLEVBQUUsY0FBYyxDQUFDLFVBQVU7U0FDOUMsQ0FBQztRQUVGLHlCQUF5QjtRQUN6QixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxVQUFVLENBQUMsZUFBZSxDQUFDLFFBQVE7WUFDMUMsV0FBVyxFQUFFLHNCQUFzQjtZQUNuQyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxxQkFBcUI7U0FDbkQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxVQUFVO1lBQzVCLFdBQVcsRUFBRSxpQkFBaUI7WUFDOUIsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsZ0JBQWdCO1NBQzlDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxVQUFVLENBQUMsTUFBTyxDQUFDLFNBQVM7WUFDbkMsV0FBVyxFQUFFLDRCQUE0QjtZQUN6QyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxlQUFlO1NBQzdDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxVQUFVO1lBQ2hDLFdBQVcsRUFBRSx5QkFBeUI7WUFDdEMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMscUJBQXFCO1NBQ25ELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7WUFDL0MsV0FBVyxFQUFFLHFCQUFxQjtZQUNsQyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxnQkFBZ0I7U0FDOUMsQ0FBQyxDQUFDO1FBRUgsV0FBVztRQUNYLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUscUJBQXFCLENBQUMsQ0FBQztRQUN4RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNGO0FBdk9ELDhCQXVPQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIHJkcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtcmRzJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGdsdWUgZnJvbSAnYXdzLWNkay1saWIvYXdzLWdsdWUnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgeyBOZXR3b3JrU3RhY2tPdXRwdXRzLCBEYXRhU3RhY2tPdXRwdXRzIH0gZnJvbSAnLi90eXBlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGF0YVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIG5ldHdvcmtPdXRwdXRzOiBOZXR3b3JrU3RhY2tPdXRwdXRzO1xuICBkYXRhYmFzZU5hbWU/OiBzdHJpbmc7XG4gIGRhdGFiYXNlVXNlcm5hbWU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBEYXRhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgb3V0cHV0czogRGF0YVN0YWNrT3V0cHV0cztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRGF0YVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgbmV0d29ya091dHB1dHMgfSA9IHByb3BzO1xuICAgIGNvbnN0IGRhdGFiYXNlTmFtZSA9IHByb3BzLmRhdGFiYXNlTmFtZSB8fCAndW5pdHljYXRhbG9nJztcbiAgICBjb25zdCBkYXRhYmFzZVVzZXJuYW1lID0gcHJvcHMuZGF0YWJhc2VVc2VybmFtZSB8fCAndW5pdHljYXRhbG9nJztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBSRFMgQXVyb3JhIFNlcnZlcmxlc3MgdjIgUG9zdGdyZVNRTFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIENyZWF0ZSBzdWJuZXQgZ3JvdXAgZm9yIFJEU1xuICAgIGNvbnN0IGRiU3VibmV0R3JvdXAgPSBuZXcgcmRzLlN1Ym5ldEdyb3VwKHRoaXMsICdSZHNTdWJuZXRHcm91cCcsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3VibmV0IGdyb3VwIGZvciBVbml0eSBDYXRhbG9nIFJEUycsXG4gICAgICB2cGM6IG5ldHdvcmtPdXRwdXRzLnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0czogbmV0d29ya091dHB1dHMucHJpdmF0ZVN1Ym5ldHMsXG4gICAgICB9LFxuICAgICAgc3VibmV0R3JvdXBOYW1lOiAndW5pdHktY2F0YWxvZy1kYi1zdWJuZXQtZ3JvdXAnLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFJEUyBjbHVzdGVyIHdpdGggQXVyb3JhIFNlcnZlcmxlc3MgdjJcbiAgICBjb25zdCByZHNDbHVzdGVyID0gbmV3IHJkcy5EYXRhYmFzZUNsdXN0ZXIodGhpcywgJ1VuaXR5Q2F0YWxvZ0NsdXN0ZXInLCB7XG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUNsdXN0ZXJFbmdpbmUuYXVyb3JhUG9zdGdyZXMoe1xuICAgICAgICB2ZXJzaW9uOiByZHMuQXVyb3JhUG9zdGdyZXNFbmdpbmVWZXJzaW9uLlZFUl8xNV84LFxuICAgICAgfSksXG4gICAgICBjbHVzdGVySWRlbnRpZmllcjogJ3VuaXR5LWNhdGFsb2ctZGInLFxuICAgICAgZGVmYXVsdERhdGFiYXNlTmFtZTogZGF0YWJhc2VOYW1lLFxuICAgICAgY3JlZGVudGlhbHM6IHJkcy5DcmVkZW50aWFscy5mcm9tR2VuZXJhdGVkU2VjcmV0KGRhdGFiYXNlVXNlcm5hbWUsIHtcbiAgICAgICAgc2VjcmV0TmFtZTogYCR7ZGF0YWJhc2VOYW1lfS1kYi1jcmVkZW50aWFsc2AsXG4gICAgICB9KSxcbiAgICAgIHZwYzogbmV0d29ya091dHB1dHMudnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRzOiBuZXR3b3JrT3V0cHV0cy5wcml2YXRlU3VibmV0cyxcbiAgICAgIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW25ldHdvcmtPdXRwdXRzLnJkc1NlY3VyaXR5R3JvdXBdLFxuICAgICAgc2VydmVybGVzc1YyTWluQ2FwYWNpdHk6IDAuNSxcbiAgICAgIHNlcnZlcmxlc3NWMk1heENhcGFjaXR5OiAyLFxuICAgICAgd3JpdGVyOiByZHMuQ2x1c3Rlckluc3RhbmNlLnNlcnZlcmxlc3NWMignd3JpdGVyJyksXG4gICAgICBzdG9yYWdlRW5jcnlwdGVkOiB0cnVlLFxuICAgICAgYmFja3VwOiB7XG4gICAgICAgIHJldGVudGlvbjogY2RrLkR1cmF0aW9uLmRheXMoNyksXG4gICAgICB9LFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUzMgQnVja2V0IGZvciBHbHVlIERhdGFcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBjb25zdCBnbHVlRGF0YUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0dsdWVEYXRhQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGNhdGFsb2ctYWdlbnRzLWdsdWUtZGF0YS0ke3RoaXMuYWNjb3VudH0tJHt0aGlzLnJlZ2lvbn1gLFxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBBV1MgR2x1ZSBDYXRhbG9nXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gQ3JlYXRlIEdsdWUgRGF0YWJhc2VzXG4gICAgY29uc3QgY3VzdG9tZXJEYXRhYmFzZSA9IG5ldyBnbHVlLkNmbkRhdGFiYXNlKHRoaXMsICdDdXN0b21lckRhdGFiYXNlJywge1xuICAgICAgY2F0YWxvZ0lkOiB0aGlzLmFjY291bnQsXG4gICAgICBkYXRhYmFzZUlucHV0OiB7XG4gICAgICAgIG5hbWU6ICdjdXN0b21lcl9kYXRhYmFzZScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ3VzdG9tZXIgZGF0YSBjYXRhbG9nJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBzYWxlc0RhdGFiYXNlID0gbmV3IGdsdWUuQ2ZuRGF0YWJhc2UodGhpcywgJ1NhbGVzRGF0YWJhc2UnLCB7XG4gICAgICBjYXRhbG9nSWQ6IHRoaXMuYWNjb3VudCxcbiAgICAgIGRhdGFiYXNlSW5wdXQ6IHtcbiAgICAgICAgbmFtZTogJ3NhbGVzX2RhdGFiYXNlJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdTYWxlcyBkYXRhIGNhdGFsb2cnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFuYWx5dGljc0RhdGFiYXNlID0gbmV3IGdsdWUuQ2ZuRGF0YWJhc2UodGhpcywgJ0FuYWx5dGljc0RhdGFiYXNlJywge1xuICAgICAgY2F0YWxvZ0lkOiB0aGlzLmFjY291bnQsXG4gICAgICBkYXRhYmFzZUlucHV0OiB7XG4gICAgICAgIG5hbWU6ICdhbmFseXRpY3NfZGF0YWJhc2UnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FuYWx5dGljcyBkYXRhIGNhdGFsb2cnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBHbHVlIFRhYmxlc1xuICAgIC8vIEN1c3RvbWVyIFByb2ZpbGUgVGFibGVcbiAgICBjb25zdCBjdXN0b21lclByb2ZpbGVUYWJsZSA9IG5ldyBnbHVlLkNmblRhYmxlKHRoaXMsICdDdXN0b21lclByb2ZpbGVUYWJsZScsIHtcbiAgICAgIGNhdGFsb2dJZDogdGhpcy5hY2NvdW50LFxuICAgICAgZGF0YWJhc2VOYW1lOiBjdXN0b21lckRhdGFiYXNlLnJlZixcbiAgICAgIHRhYmxlSW5wdXQ6IHtcbiAgICAgICAgbmFtZTogJ2N1c3RvbWVyX3Byb2ZpbGUnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0N1c3RvbWVyIHByb2ZpbGUgaW5mb3JtYXRpb24nLFxuICAgICAgICB0YWJsZVR5cGU6ICdFWFRFUk5BTF9UQUJMRScsXG4gICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAnY2xhc3NpZmljYXRpb24nOiAncGFycXVldCcsXG4gICAgICAgICAgJ2NvbXByZXNzaW9uVHlwZSc6ICdub25lJyxcbiAgICAgICAgfSxcbiAgICAgICAgc3RvcmFnZURlc2NyaXB0b3I6IHtcbiAgICAgICAgICBsb2NhdGlvbjogYHMzOi8vJHtnbHVlRGF0YUJ1Y2tldC5idWNrZXROYW1lfS9jdXN0b21lcl9wcm9maWxlL2AsXG4gICAgICAgICAgaW5wdXRGb3JtYXQ6ICdvcmcuYXBhY2hlLmhhZG9vcC5oaXZlLnFsLmlvLnBhcnF1ZXQuTWFwcmVkUGFycXVldElucHV0Rm9ybWF0JyxcbiAgICAgICAgICBvdXRwdXRGb3JtYXQ6ICdvcmcuYXBhY2hlLmhhZG9vcC5oaXZlLnFsLmlvLnBhcnF1ZXQuTWFwcmVkUGFycXVldE91dHB1dEZvcm1hdCcsXG4gICAgICAgICAgc2VyZGVJbmZvOiB7XG4gICAgICAgICAgICBzZXJpYWxpemF0aW9uTGlicmFyeTogJ29yZy5hcGFjaGUuaGFkb29wLmhpdmUucWwuaW8ucGFycXVldC5zZXJkZS5QYXJxdWV0SGl2ZVNlckRlJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbHVtbnM6IFtcbiAgICAgICAgICAgIHsgbmFtZTogJ2N1c3RvbWVyX2lkJywgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ25hbWUnLCB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnZW1haWwnLCB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnY3JlYXRlZF9hdCcsIHR5cGU6ICd0aW1lc3RhbXAnIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDdXN0b21lciBPcmRlcnMgVGFibGVcbiAgICBjb25zdCBjdXN0b21lck9yZGVyc1RhYmxlID0gbmV3IGdsdWUuQ2ZuVGFibGUodGhpcywgJ0N1c3RvbWVyT3JkZXJzVGFibGUnLCB7XG4gICAgICBjYXRhbG9nSWQ6IHRoaXMuYWNjb3VudCxcbiAgICAgIGRhdGFiYXNlTmFtZTogc2FsZXNEYXRhYmFzZS5yZWYsXG4gICAgICB0YWJsZUlucHV0OiB7XG4gICAgICAgIG5hbWU6ICdjdXN0b21lcl9vcmRlcnMnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0N1c3RvbWVyIG9yZGVyIHRyYW5zYWN0aW9ucycsXG4gICAgICAgIHRhYmxlVHlwZTogJ0VYVEVSTkFMX1RBQkxFJyxcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICdjbGFzc2lmaWNhdGlvbic6ICdwYXJxdWV0JyxcbiAgICAgICAgICAnY29tcHJlc3Npb25UeXBlJzogJ25vbmUnLFxuICAgICAgICB9LFxuICAgICAgICBzdG9yYWdlRGVzY3JpcHRvcjoge1xuICAgICAgICAgIGxvY2F0aW9uOiBgczM6Ly8ke2dsdWVEYXRhQnVja2V0LmJ1Y2tldE5hbWV9L2N1c3RvbWVyX29yZGVycy9gLFxuICAgICAgICAgIGlucHV0Rm9ybWF0OiAnb3JnLmFwYWNoZS5oYWRvb3AuaGl2ZS5xbC5pby5wYXJxdWV0Lk1hcHJlZFBhcnF1ZXRJbnB1dEZvcm1hdCcsXG4gICAgICAgICAgb3V0cHV0Rm9ybWF0OiAnb3JnLmFwYWNoZS5oYWRvb3AuaGl2ZS5xbC5pby5wYXJxdWV0Lk1hcHJlZFBhcnF1ZXRPdXRwdXRGb3JtYXQnLFxuICAgICAgICAgIHNlcmRlSW5mbzoge1xuICAgICAgICAgICAgc2VyaWFsaXphdGlvbkxpYnJhcnk6ICdvcmcuYXBhY2hlLmhhZG9vcC5oaXZlLnFsLmlvLnBhcnF1ZXQuc2VyZGUuUGFycXVldEhpdmVTZXJEZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb2x1bW5zOiBbXG4gICAgICAgICAgICB7IG5hbWU6ICdvcmRlcl9pZCcsIHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdjdXN0b21lcl9pZCcsIHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdwcm9kdWN0X2lkJywgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ3F1YW50aXR5JywgdHlwZTogJ2ludCcgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ2Ftb3VudCcsIHR5cGU6ICdkZWNpbWFsKDEwLDIpJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnb3JkZXJfZGF0ZScsIHR5cGU6ICd0aW1lc3RhbXAnIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBEYWlseSBTYWxlcyBTdW1tYXJ5IFRhYmxlXG4gICAgY29uc3QgZGFpbHlTYWxlc1N1bW1hcnlUYWJsZSA9IG5ldyBnbHVlLkNmblRhYmxlKHRoaXMsICdEYWlseVNhbGVzU3VtbWFyeVRhYmxlJywge1xuICAgICAgY2F0YWxvZ0lkOiB0aGlzLmFjY291bnQsXG4gICAgICBkYXRhYmFzZU5hbWU6IGFuYWx5dGljc0RhdGFiYXNlLnJlZixcbiAgICAgIHRhYmxlSW5wdXQ6IHtcbiAgICAgICAgbmFtZTogJ2RhaWx5X3NhbGVzX3N1bW1hcnknLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0RhaWx5IGFnZ3JlZ2F0ZWQgc2FsZXMgbWV0cmljcycsXG4gICAgICAgIHRhYmxlVHlwZTogJ0VYVEVSTkFMX1RBQkxFJyxcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICdjbGFzc2lmaWNhdGlvbic6ICdwYXJxdWV0JyxcbiAgICAgICAgICAnY29tcHJlc3Npb25UeXBlJzogJ25vbmUnLFxuICAgICAgICB9LFxuICAgICAgICBzdG9yYWdlRGVzY3JpcHRvcjoge1xuICAgICAgICAgIGxvY2F0aW9uOiBgczM6Ly8ke2dsdWVEYXRhQnVja2V0LmJ1Y2tldE5hbWV9L2RhaWx5X3NhbGVzX3N1bW1hcnkvYCxcbiAgICAgICAgICBpbnB1dEZvcm1hdDogJ29yZy5hcGFjaGUuaGFkb29wLmhpdmUucWwuaW8ucGFycXVldC5NYXByZWRQYXJxdWV0SW5wdXRGb3JtYXQnLFxuICAgICAgICAgIG91dHB1dEZvcm1hdDogJ29yZy5hcGFjaGUuaGFkb29wLmhpdmUucWwuaW8ucGFycXVldC5NYXByZWRQYXJxdWV0T3V0cHV0Rm9ybWF0JyxcbiAgICAgICAgICBzZXJkZUluZm86IHtcbiAgICAgICAgICAgIHNlcmlhbGl6YXRpb25MaWJyYXJ5OiAnb3JnLmFwYWNoZS5oYWRvb3AuaGl2ZS5xbC5pby5wYXJxdWV0LnNlcmRlLlBhcnF1ZXRIaXZlU2VyRGUnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29sdW1uczogW1xuICAgICAgICAgICAgeyBuYW1lOiAnZGF0ZScsIHR5cGU6ICdkYXRlJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAndG90YWxfb3JkZXJzJywgdHlwZTogJ2ludCcgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ3RvdGFsX3JldmVudWUnLCB0eXBlOiAnZGVjaW1hbCgxMiwyKScgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ3VuaXF1ZV9jdXN0b21lcnMnLCB0eXBlOiAnaW50JyB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gU3RvcmUgb3V0cHV0c1xuICAgIHRoaXMub3V0cHV0cyA9IHtcbiAgICAgIHJkc0NsdXN0ZXIsXG4gICAgICByZHNTZWNyZXQ6IHJkc0NsdXN0ZXIuc2VjcmV0ISxcbiAgICAgIHJkc1NlY3JldEFybjogcmRzQ2x1c3Rlci5zZWNyZXQhLnNlY3JldEFybixcbiAgICAgIGdsdWVEYXRhYmFzZU5hbWVzOiBbXG4gICAgICAgIGN1c3RvbWVyRGF0YWJhc2UucmVmLFxuICAgICAgICBzYWxlc0RhdGFiYXNlLnJlZixcbiAgICAgICAgYW5hbHl0aWNzRGF0YWJhc2UucmVmLFxuICAgICAgXSxcbiAgICAgIGdsdWVEYXRhQnVja2V0TmFtZTogZ2x1ZURhdGFCdWNrZXQuYnVja2V0TmFtZSxcbiAgICB9O1xuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZHNDbHVzdGVyRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogcmRzQ2x1c3Rlci5jbHVzdGVyRW5kcG9pbnQuaG9zdG5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JEUyBDbHVzdGVyIEVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1SZHNDbHVzdGVyRW5kcG9pbnRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jkc0NsdXN0ZXJBcm4nLCB7XG4gICAgICB2YWx1ZTogcmRzQ2x1c3Rlci5jbHVzdGVyQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdSRFMgQ2x1c3RlciBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVJkc0NsdXN0ZXJBcm5gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jkc1NlY3JldEFybicsIHtcbiAgICAgIHZhbHVlOiByZHNDbHVzdGVyLnNlY3JldCEuc2VjcmV0QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdSRFMgQ3JlZGVudGlhbHMgU2VjcmV0IEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUmRzU2VjcmV0QXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHbHVlRGF0YUJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogZ2x1ZURhdGFCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgQnVja2V0IGZvciBHbHVlIERhdGEnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUdsdWVEYXRhQnVja2V0TmFtZWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR2x1ZURhdGFiYXNlcycsIHtcbiAgICAgIHZhbHVlOiB0aGlzLm91dHB1dHMuZ2x1ZURhdGFiYXNlTmFtZXMuam9pbignLCcpLFxuICAgICAgZGVzY3JpcHRpb246ICdHbHVlIERhdGFiYXNlIE5hbWVzJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1HbHVlRGF0YWJhc2VzYCxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YWdzXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ2NhdGFsb2ctYWdlbnRzLWRlbW8nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgJ2RldicpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTWFuYWdlZEJ5JywgJ0NESycpO1xuICB9XG59XG4iXX0=