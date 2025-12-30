#!/usr/bin/env python3
import boto3
import json

def test_agentcore_runtime(runtime_id):
    client = boto3.client('bedrock-agentcore-control')
    
    try:
        # Check runtime status
        response = client.get_agent_runtime(agentRuntimeId=runtime_id)
        print(f"Runtime {runtime_id}:")
        print(f"Status: {response.get('status')}")
        print(f"Name: {response.get('agentRuntimeName')}")
        print(f"Description: {response.get('description')}")
        print("-" * 50)
        
    except Exception as e:
        print(f"Error checking {runtime_id}: {e}")

if __name__ == "__main__":
    # Check Unity Catalog runtime - NEW ID
    test_agentcore_runtime('unityCatalogMcp_42edc330-RHq7wpHISz')
    
    # Check Glue Catalog runtime - NEW ID
    test_agentcore_runtime('glueCatalogMcp_42edc330-51wG6SE1WY')
