#!/usr/bin/env python3
"""
Script to create sample databases and tables in AWS Glue catalog for testing.
"""
import boto3
import json

def create_sample_glue_data():
    glue = boto3.client('glue')
    
    # Create sample database
    database_name = 'sample_catalog_db'
    
    try:
        glue.create_database(
            DatabaseInput={
                'Name': database_name,
                'Description': 'Sample database for catalog agents demo'
            }
        )
        print(f"Created database: {database_name}")
    except glue.exceptions.AlreadyExistsException:
        print(f"Database {database_name} already exists")
    
    # Sample table definitions
    tables = [
        {
            'Name': 'customer_data',
            'StorageDescriptor': {
                'Columns': [
                    {'Name': 'customer_id', 'Type': 'string'},
                    {'Name': 'first_name', 'Type': 'string'},
                    {'Name': 'last_name', 'Type': 'string'},
                    {'Name': 'email', 'Type': 'string'},
                    {'Name': 'created_timestamp', 'Type': 'timestamp'},
                    {'Name': 'status', 'Type': 'string'}
                ],
                'Location': 's3://your-bucket/customer-data/',
                'InputFormat': 'org.apache.hadoop.mapred.TextInputFormat',
                'OutputFormat': 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
                'SerdeInfo': {
                    'SerializationLibrary': 'org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe'
                }
            },
            'Description': 'Customer information table'
        },
        {
            'Name': 'order_history',
            'StorageDescriptor': {
                'Columns': [
                    {'Name': 'order_id', 'Type': 'string'},
                    {'Name': 'customer_id', 'Type': 'string'},
                    {'Name': 'product_name', 'Type': 'string'},
                    {'Name': 'quantity', 'Type': 'int'},
                    {'Name': 'price', 'Type': 'decimal(10,2)'},
                    {'Name': 'order_timestamp', 'Type': 'timestamp'}
                ],
                'Location': 's3://your-bucket/order-history/',
                'InputFormat': 'org.apache.hadoop.mapred.TextInputFormat',
                'OutputFormat': 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
                'SerdeInfo': {
                    'SerializationLibrary': 'org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe'
                }
            },
            'Description': 'Order history and transaction data'
        },
        {
            'Name': 'product_catalog',
            'StorageDescriptor': {
                'Columns': [
                    {'Name': 'product_id', 'Type': 'string'},
                    {'Name': 'product_name', 'Type': 'string'},
                    {'Name': 'category', 'Type': 'string'},
                    {'Name': 'price', 'Type': 'decimal(10,2)'},
                    {'Name': 'description', 'Type': 'string'},
                    {'Name': 'created_timestamp', 'Type': 'timestamp'}
                ],
                'Location': 's3://your-bucket/product-catalog/',
                'InputFormat': 'org.apache.hadoop.mapred.TextInputFormat',
                'OutputFormat': 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
                'SerdeInfo': {
                    'SerializationLibrary': 'org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe'
                }
            },
            'Description': 'Product catalog with pricing information'
        }
    ]
    
    # Create tables
    for table in tables:
        try:
            glue.create_table(
                DatabaseName=database_name,
                TableInput=table
            )
            print(f"Created table: {table['Name']}")
        except glue.exceptions.AlreadyExistsException:
            print(f"Table {table['Name']} already exists")
    
    print(f"\nSample data setup complete!")
    print(f"Database: {database_name}")
    print(f"Tables: {', '.join([t['Name'] for t in tables])}")

if __name__ == "__main__":
    create_sample_glue_data()
