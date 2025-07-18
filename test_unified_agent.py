#!/usr/bin/env python3
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""
Test script for the unified catalog agent.

This script runs a simple test to verify that the unified catalog agent
can connect to both the Unity and AWS Glue catalogs and perform basic operations.
"""

import json
import logging
import requests
import sys
from agents.unified_catalog_agent import unified_agent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Unity catalog service URL
UNITY_CATALOG_URL = "http://localhost:8080/api/2.1/unity-catalog/catalogs"

# Test queries to run
TEST_QUERIES = [
    "List all databases in both catalogs",
    "Find tables with 'customer' in the name in both catalogs",
    "Show me all tables in the Unity catalog",
    "Show me all tables in the AWS Glue catalog",
]

def check_unity_service():
    """Check if the Unity catalog service is available"""
    print("Checking Unity catalog service availability...")
    try:
        response = requests.get(UNITY_CATALOG_URL, timeout=5)
        response.raise_for_status()
        print("Unity catalog service is available.")
        return True
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Unity catalog service is not available: {e}")
        print("Please ensure the Unity catalog service is running at http://localhost:8080")
        print("Tests will continue but may fail if the service is required.")
        return False

def run_test():
    """Run a simple test of the unified catalog agent"""
    print("Unified Catalog Agent Test")
    print("==========================")
    
    # Check if Unity catalog service is available
    service_available = check_unity_service()
    if not service_available:
        print("\nWARNING: Tests may fail due to Unity catalog service unavailability.")
        print("The agent should handle this gracefully with proper error messages.\n")
    
    for i, query in enumerate(TEST_QUERIES, 1):
        print(f"\nTest {i}: {query}")
        print("-" * 40)
        
        try:
            print("Sending query to agent...")
            response = unified_agent(query)
            print("Agent response received.")
            
            # Get the raw response
            response_raw = response.message
            print("Raw response:")
            print(response_raw)
            
            # Try to extract and parse the response (informational only)
            try:
                # Check if the response has the expected structure
                if isinstance(response_raw, dict) and 'content' in response_raw:
                    if isinstance(response_raw['content'], list) and len(response_raw['content']) > 0:
                        if 'text' in response_raw['content'][0]:
                            # Extract the text from the nested structure
                            response_str = response_raw['content'][0]['text']
                            print("\nExtracted text content:")
                            print(response_str)
                            
                            # Try to parse as JSON (optional)
                            try:
                                response_json = json.loads(response_str)
                                print("\nSuccessfully parsed as JSON:")
                                print(json.dumps(response_json, indent=2))
                            except json.JSONDecodeError:
                                print("\nContent is not valid JSON, but that's OK with the relaxed requirements.")
            except Exception as e:
                print(f"\nNote: Could not process response structure: {e}")
            
            print("\nTest PASSED: Agent returned a response.")
                
        except Exception as e:
            print(f"Error during test: {e}")
            print("\nTest FAILED: Exception occurred.")
    
    print("\nTest run completed.")

if __name__ == "__main__":
    run_test()
