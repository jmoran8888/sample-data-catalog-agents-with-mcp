from aws_cdk import (
    Stack,
    aws_glue as glue,
    aws_s3 as s3,
    CfnParameter,
)
from constructs import Construct
import aws_cdk as cdk


class GlueStack(Stack):
    """Glue Stack - Glue Databases and Tables for Sample Data"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        glue_data_bucket: s3.Bucket,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Parameter for environment tagging
        self.environment = CfnParameter(
            self,
            "Environment",
            type="String",
            description="Environment name",
            default="dev"
        )

        # Glue Database - Customer Data
        self.customer_db = glue.CfnDatabase(
            self,
            "CustomerDatabase",
            catalog_id=self.account,
            database_input=glue.CfnDatabase.DatabaseInputProperty(
                name="customer_database",
                description="Customer data catalog for demo purposes"
            )
        )

        # Glue Database - Sales Data
        self.sales_db = glue.CfnDatabase(
            self,
            "SalesDatabase",
            catalog_id=self.account,
            database_input=glue.CfnDatabase.DatabaseInputProperty(
                name="sales_database",
                description="Sales data catalog for demo purposes"
            )
        )

        # Glue Database - Analytics
        self.analytics_db = glue.CfnDatabase(
            self,
            "AnalyticsDatabase",
            catalog_id=self.account,
            database_input=glue.CfnDatabase.DatabaseInputProperty(
                name="analytics_database",
                description="Analytics data catalog for demo purposes"
            )
        )

        # Sample Glue Table - Customer Profile
        self.customer_profile_table = glue.CfnTable(
            self,
            "CustomerProfileTable",
            catalog_id=self.account,
            database_name="customer_database",
            table_input=glue.CfnTable.TableInputProperty(
                name="customer_profile",
                description="Customer profile information",
                table_type="EXTERNAL_TABLE",
                parameters={
                    "classification": "parquet"
                },
                storage_descriptor=glue.CfnTable.StorageDescriptorProperty(
                    location=f"s3://{glue_data_bucket.bucket_name}/customer/profile/",
                    input_format="org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
                    output_format="org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
                    serde_info=glue.CfnTable.SerdeInfoProperty(
                        serialization_library="org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
                    ),
                    columns=[
                        glue.CfnTable.ColumnProperty(name="customer_id", type="bigint"),
                        glue.CfnTable.ColumnProperty(name="first_name", type="string"),
                        glue.CfnTable.ColumnProperty(name="last_name", type="string"),
                        glue.CfnTable.ColumnProperty(name="email", type="string"),
                        glue.CfnTable.ColumnProperty(name="created_timestamp", type="timestamp")
                    ]
                )
            )
        )
        self.customer_profile_table.add_dependency(self.customer_db)

        # Sample Glue Table - Customer Orders
        self.customer_orders_table = glue.CfnTable(
            self,
            "CustomerOrdersTable",
            catalog_id=self.account,
            database_name="sales_database",
            table_input=glue.CfnTable.TableInputProperty(
                name="customer_orders",
                description="Customer order transactions",
                table_type="EXTERNAL_TABLE",
                parameters={
                    "classification": "parquet"
                },
                storage_descriptor=glue.CfnTable.StorageDescriptorProperty(
                    location=f"s3://{glue_data_bucket.bucket_name}/sales/orders/",
                    input_format="org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
                    output_format="org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
                    serde_info=glue.CfnTable.SerdeInfoProperty(
                        serialization_library="org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
                    ),
                    columns=[
                        glue.CfnTable.ColumnProperty(name="order_id", type="bigint"),
                        glue.CfnTable.ColumnProperty(name="customer_id", type="bigint"),
                        glue.CfnTable.ColumnProperty(name="product_name", type="string"),
                        glue.CfnTable.ColumnProperty(name="quantity", type="int"),
                        glue.CfnTable.ColumnProperty(name="price", type="decimal(10,2)"),
                        glue.CfnTable.ColumnProperty(name="order_timestamp", type="timestamp")
                    ]
                )
            )
        )
        self.customer_orders_table.add_dependency(self.sales_db)

        # Sample Glue Table - Analytics Summary
        self.analytics_summary_table = glue.CfnTable(
            self,
            "AnalyticsSummaryTable",
            catalog_id=self.account,
            database_name="analytics_database",
            table_input=glue.CfnTable.TableInputProperty(
                name="daily_sales_summary",
                description="Daily sales analytics summary",
                table_type="EXTERNAL_TABLE",
                parameters={
                    "classification": "parquet"
                },
                storage_descriptor=glue.CfnTable.StorageDescriptorProperty(
                    location=f"s3://{glue_data_bucket.bucket_name}/analytics/daily_summary/",
                    input_format="org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
                    output_format="org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
                    serde_info=glue.CfnTable.SerdeInfoProperty(
                        serialization_library="org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
                    ),
                    columns=[
                        glue.CfnTable.ColumnProperty(name="date", type="date"),
                        glue.CfnTable.ColumnProperty(name="total_orders", type="bigint"),
                        glue.CfnTable.ColumnProperty(name="total_revenue", type="decimal(15,2)"),
                        glue.CfnTable.ColumnProperty(name="unique_customers", type="bigint"),
                        glue.CfnTable.ColumnProperty(name="created_timestamp", type="timestamp")
                    ]
                )
            )
        )
        self.analytics_summary_table.add_dependency(self.analytics_db)

        # Store bucket reference
        self.glue_data_bucket = glue_data_bucket
