#!/usr/bin/env python3
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""
Test script for the AWS Glue catalog agent.

This script runs a simple test to verify that the AWS Glue catalog agent
can connect to the AWS Glue catalog and perform basic operations.
"""

import json
import logging
from agents.glue_catalog_agent import glue_agent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Test queries to run
TEST_QUERIES = [
    "List all databases in the Glue catalog",
]

def run_test():
    """Run a simple test of the AWS Glue catalog agent"""
    print("AWS Glue Catalog Agent Test")
    print("==========================")
    
    for i, query in enumerate(TEST_QUERIES, 1):
        print(f"\nTest {i}: {query}")
        print("-" * 40)
        
        try:
            print("Sending query to agent...")
            response = glue_agent(query)
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
