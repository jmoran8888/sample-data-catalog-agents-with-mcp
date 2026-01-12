#!/usr/bin/env python3
"""
Script to add sample tables to Unity Catalog for AWS deployment via SSM tunnel.
Uses port 8443 (HTTPS) - exact same table definitions as setup_unity_simple.py.
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
    
    # Simple tables with basic types only
    tables = [
        {
            "schema": "retail",
            "name": "customers",
            "comment": "Customer information",
            "columns": [
                {"name": "customer_id", "type_name": "STRING", "nullable": False, "comment": "Customer ID"},
                {"name": "first_name", "type_name": "STRING", "nullable": True, "comment": "First name"},
                {"name": "last_name", "type_name": "STRING", "nullable": True, "comment": "Last name"},
                {"name": "email", "type_name": "STRING", "nullable": True, "comment": "Email address"},
                {"name": "city", "type_name": "STRING", "nullable": True, "comment": "City"}
            ]
        },
        {
            "schema": "retail",
            "name": "orders",
            "comment": "Order information",
            "columns": [
                {"name": "order_id", "type_name": "STRING", "nullable": False, "comment": "Order ID"},
                {"name": "customer_id", "type_name": "STRING", "nullable": False, "comment": "Customer ID"},
                {"name": "product_name", "type_name": "STRING", "nullable": True, "comment": "Product name"},
                {"name": "quantity", "type_name": "LONG", "nullable": True, "comment": "Quantity"},
                {"name": "order_date", "type_name": "STRING", "nullable": True, "comment": "Order date"}
            ]
        },
        {
            "schema": "analytics",
            "name": "sales_summary",
            "comment": "Sales summary data",
            "columns": [
                {"name": "date", "type_name": "STRING", "nullable": False, "comment": "Sales date"},
                {"name": "region", "type_name": "STRING", "nullable": True, "comment": "Region"},
                {"name": "total_sales", "type_name": "DOUBLE", "nullable": True, "comment": "Total sales"},
                {"name": "order_count", "type_name": "LONG", "nullable": True, "comment": "Number of orders"}
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
    
    print(f"\n✓ Simple sample data setup complete!")

if __name__ == "__main__":
    main()
