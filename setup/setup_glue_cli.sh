#!/bin/bash

# Create sample database
echo "Creating sample database..."
aws glue create-database --database-input Name=sample_catalog_db,Description="Sample database for catalog agents demo"

# Create customer_data table
echo "Creating customer_data table..."
aws glue create-table --database-name sample_catalog_db --table-input '{
  "Name": "customer_data",
  "Description": "Customer information table",
  "StorageDescriptor": {
    "Columns": [
      {"Name": "customer_id", "Type": "string"},
      {"Name": "first_name", "Type": "string"},
      {"Name": "last_name", "Type": "string"},
      {"Name": "email", "Type": "string"},
      {"Name": "created_timestamp", "Type": "timestamp"},
      {"Name": "status", "Type": "string"}
    ],
    "Location": "s3://sample-bucket/customer-data/",
    "InputFormat": "org.apache.hadoop.mapred.TextInputFormat",
    "OutputFormat": "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
    "SerdeInfo": {
      "SerializationLibrary": "org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe"
    }
  }
}'

# Create order_history table
echo "Creating order_history table..."
aws glue create-table --database-name sample_catalog_db --table-input '{
  "Name": "order_history",
  "Description": "Order history and transaction data",
  "StorageDescriptor": {
    "Columns": [
      {"Name": "order_id", "Type": "string"},
      {"Name": "customer_id", "Type": "string"},
      {"Name": "product_name", "Type": "string"},
      {"Name": "quantity", "Type": "int"},
      {"Name": "price", "Type": "decimal(10,2)"},
      {"Name": "order_timestamp", "Type": "timestamp"}
    ],
    "Location": "s3://sample-bucket/order-history/",
    "InputFormat": "org.apache.hadoop.mapred.TextInputFormat",
    "OutputFormat": "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
    "SerdeInfo": {
      "SerializationLibrary": "org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe"
    }
  }
}'

echo "Sample Glue catalog setup complete!"
echo "Database: sample_catalog_db"
echo "Tables: customer_data, order_history"
