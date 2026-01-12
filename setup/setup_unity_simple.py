#!/usr/bin/env python3
"""
Simplified script to add sample tables to Unity Catalog using basic types.
Supports both local (port 8080) and AWS SSM tunnel (port 8443) access.
"""

import requests
import json
import os
import urllib3
import argparse

def get_base_url(port=None):
    """Get BASE_URL with support for port parameter"""
    # Priority: 1. Environment variable, 2. Port parameter, 3. Default 8080
    if os.environ.get('UNITY_CATALOG_URL'):
        return os.environ.get('UNITY_CATALOG_URL')
    
    port = port or 8080
    protocol = 'https' if port == 8443 else 'http'
    return f'{protocol}://localhost:{port}/api/2.1/unity-catalog'

# Parse command line arguments
parser = argparse.ArgumentParser(description='Populate Unity Catalog with sample data')
parser.add_argument('--port', type=int, choices=[8080, 8443], 
                    help='Port number (8080 for local, 8443 for AWS SSM tunnel)')
args = parser.parse_args()

BASE_URL = get_base_url(args.port)

# Disable SSL warnings if HTTPS (port 8443)
if 'https://' in BASE_URL or os.environ.get('DISABLE_SSL_VERIFY'):
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    VERIFY_SSL = False
else:
    VERIFY_SSL = True

print(f"Using Unity Catalog URL: {BASE_URL}")
if not VERIFY_SSL:
    print("SSL verification disabled")

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
