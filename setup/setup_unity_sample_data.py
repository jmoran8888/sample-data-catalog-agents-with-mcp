#!/usr/bin/env python3
"""
Script to add sample tables to Unity Catalog for AWS deployment via SSM tunnel.
Uses port 8443 (HTTPS) for SSM port forwarding access.
For local development, use setup_unity_simple.py instead.
"""

import requests
import json
import urllib3

# Unity Catalog API via SSM tunnel at port 8443 (HTTPS)
BASE_URL = "https://localhost:8443/api/2.1/unity-catalog"

# Disable SSL warnings for self-signed certificate
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
VERIFY_SSL = False

print(f"Using Unity Catalog URL: {BASE_URL}")
print("SSL verification disabled (self-signed certificate)")

def create_schema(catalog_name, schema_name):
    """Create a schema in Unity Catalog"""
    url = f"{BASE_URL}/schemas"
    data = {
        "name": schema_name,
        "catalog_name": catalog_name,
        "comment": f"Sample schema for {schema_name} data"
    }
    
    response = requests.post(url, json=data, verify=VERIFY_SSL)
    if response.status_code == 201:
        print(f"✓ Created schema: {catalog_name}.{schema_name}")
    elif response.status_code == 409:
        print(f"✓ Schema already exists: {catalog_name}.{schema_name}")
    else:
        print(f"✗ Failed to create schema {schema_name}: {response.text}")
    return response.status_code in [201, 409]

def create_table(catalog_name, schema_name, table_name, columns, comment):
    """Create a table in Unity Catalog"""
    url = f"{BASE_URL}/tables"
    data = {
        "name": table_name,
        "catalog_name": catalog_name,
        "schema_name": schema_name,
        "table_type": "MANAGED",
        "data_source_format": "DELTA",
        "columns": columns,
        "comment": comment
    }
    
    response = requests.post(url, json=data, verify=VERIFY_SSL)
    if response.status_code == 201:
        print(f"✓ Created table: {catalog_name}.{schema_name}.{table_name}")
    elif response.status_code == 409:
        print(f"✓ Table already exists: {catalog_name}.{schema_name}.{table_name}")
    else:
        print(f"✗ Failed to create table {table_name}: {response.text}")
    return response.status_code in [201, 409]

def main():
    catalog_name = "unity"
    
    # Create schemas
    schemas = ["retail", "analytics", "customer_data"]
    for schema in schemas:
        create_schema(catalog_name, schema)
    
    # Sample tables with columns
    tables = [
        {
            "schema": "retail",
            "name": "customer_data",
            "comment": "Customer information and demographics",
            "columns": [
                {"name": "customer_id", "type_name": "STRING", "nullable": False, "comment": "Unique customer identifier"},
                {"name": "first_name", "type_name": "STRING", "nullable": True, "comment": "Customer first name"},
                {"name": "last_name", "type_name": "STRING", "nullable": True, "comment": "Customer last name"},
                {"name": "email", "type_name": "STRING", "nullable": True, "comment": "Customer email address"},
                {"name": "phone", "type_name": "STRING", "nullable": True, "comment": "Customer phone number"},
                {"name": "address", "type_name": "STRING", "nullable": True, "comment": "Customer address"},
                {"name": "city", "type_name": "STRING", "nullable": True, "comment": "Customer city"},
                {"name": "state", "type_name": "STRING", "nullable": True, "comment": "Customer state"},
                {"name": "zip_code", "type_name": "STRING", "nullable": True, "comment": "Customer zip code"},
                {"name": "created_at", "type_name": "TIMESTAMP", "nullable": True, "comment": "Account creation timestamp"}
            ]
        },
        {
            "schema": "retail",
            "name": "order_history",
            "comment": "Customer order transaction history",
            "columns": [
                {"name": "order_id", "type_name": "STRING", "nullable": False, "comment": "Unique order identifier"},
                {"name": "customer_id", "type_name": "STRING", "nullable": False, "comment": "Customer who placed the order"},
                {"name": "product_id", "type_name": "STRING", "nullable": False, "comment": "Product ordered"},
                {"name": "quantity", "type_name": "LONG", "nullable": False, "comment": "Quantity ordered"},
                {"name": "unit_price", "type_name": "DOUBLE", "nullable": False, "comment": "Price per unit"},
                {"name": "total_amount", "type_name": "DOUBLE", "nullable": False, "comment": "Total order amount"},
                {"name": "order_date", "type_name": "STRING", "nullable": False, "comment": "Date order was placed"},
                {"name": "status", "type_name": "STRING", "nullable": True, "comment": "Order status"},
                {"name": "created_at", "type_name": "TIMESTAMP", "nullable": True, "comment": "Order creation timestamp"}
            ]
        },
        {
            "schema": "retail",
            "name": "product_catalog",
            "comment": "Product information and inventory",
            "columns": [
                {"name": "product_id", "type_name": "STRING", "nullable": False, "comment": "Unique product identifier"},
                {"name": "product_name", "type_name": "STRING", "nullable": False, "comment": "Product name"},
                {"name": "category", "type_name": "STRING", "nullable": True, "comment": "Product category"},
                {"name": "subcategory", "type_name": "STRING", "nullable": True, "comment": "Product subcategory"},
                {"name": "brand", "type_name": "STRING", "nullable": True, "comment": "Product brand"},
                {"name": "price", "type_name": "DOUBLE", "nullable": False, "comment": "Product price"},
                {"name": "cost", "type_name": "DOUBLE", "nullable": True, "comment": "Product cost"},
                {"name": "inventory_count", "type_name": "LONG", "nullable": True, "comment": "Current inventory count"},
                {"name": "description", "type_name": "STRING", "nullable": True, "comment": "Product description"},
                {"name": "created_at", "type_name": "TIMESTAMP", "nullable": True, "comment": "Product creation timestamp"}
            ]
        },
        {
            "schema": "analytics",
            "name": "sales_metrics",
            "comment": "Daily sales performance metrics",
            "columns": [
                {"name": "date", "type_name": "STRING", "nullable": False, "comment": "Sales date"},
                {"name": "region", "type_name": "STRING", "nullable": True, "comment": "Sales region"},
                {"name": "total_sales", "type_name": "DOUBLE", "nullable": False, "comment": "Total sales amount"},
                {"name": "total_orders", "type_name": "LONG", "nullable": False, "comment": "Total number of orders"},
                {"name": "unique_customers", "type_name": "LONG", "nullable": False, "comment": "Number of unique customers"},
                {"name": "avg_order_value", "type_name": "DOUBLE", "nullable": True, "comment": "Average order value"},
                {"name": "created_at", "type_name": "TIMESTAMP", "nullable": True, "comment": "Record creation timestamp"}
            ]
        },
        {
            "schema": "customer_data",
            "name": "customer_segments",
            "comment": "Customer segmentation and behavior analysis",
            "columns": [
                {"name": "customer_id", "type_name": "STRING", "nullable": False, "comment": "Customer identifier"},
                {"name": "segment", "type_name": "STRING", "nullable": True, "comment": "Customer segment (VIP, Regular, New)"},
                {"name": "lifetime_value", "type_name": "DOUBLE", "nullable": True, "comment": "Customer lifetime value"},
                {"name": "total_orders", "type_name": "LONG", "nullable": True, "comment": "Total number of orders"},
                {"name": "avg_order_value", "type_name": "DOUBLE", "nullable": True, "comment": "Average order value"},
                {"name": "last_order_date", "type_name": "STRING", "nullable": True, "comment": "Date of last order"},
                {"name": "churn_risk", "type_name": "STRING", "nullable": True, "comment": "Churn risk level (High, Medium, Low)"},
                {"name": "updated_at", "type_name": "TIMESTAMP", "nullable": True, "comment": "Last update timestamp"}
            ]
        }
    ]
    
    # Create tables
    for table in tables:
        create_table(
            catalog_name, 
            table["schema"], 
            table["name"], 
            table["columns"], 
            table["comment"]
        )
    
    print(f"\n✓ Sample data setup complete!")
    print(f"Created {len(schemas)} schemas and {len(tables)} tables in Unity Catalog")

if __name__ == "__main__":
    main()
