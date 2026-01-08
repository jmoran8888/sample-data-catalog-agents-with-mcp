#!/usr/bin/env python3
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""
Catalog Agents Demo

This script demonstrates the usage of the AWS Glue, Unity, and Unified catalog agents.
"""

import json
import logging
import argparse
from agents.glue_catalog_agent import glue_agent
from agents.unity_catalog_agent import unity_agent
from agents.unified_catalog_agent import unified_agent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Enable debug logs for strands if needed
# logging.getLogger("strands").setLevel(logging.DEBUG)


def run_demo(agent_type="unity"):
    """Run a demonstration of the selected catalog agent
    
    Args:
        agent_type: Type of agent to use ('glue', 'unity', or 'unified')
    """
    if agent_type.lower() == "glue":
        print("AWS Glue Catalog Agent Demo")
        print("===========================")
        agent = glue_agent
    elif agent_type.lower() == "unified":
        print("Unified Catalog Agent Demo")
        print("==========================")
        agent = unified_agent
    else:  # Default to unity
        print("Unity Catalog Agent Demo")
        print("=======================")
        agent = unity_agent
    
    print("Type 'exit' to quit the demo")
    
    while True:
        query = input("\nEnter your query: ")
        if query.lower() == 'exit':
            break
            
        print("\nProcessing query...")
        try:
            response = agent(query)
            print("\nAgent Response:")
            
            # Pretty print the JSON response
            try:
                # Convert response.message to string before parsing as JSON
                response_str = str(response.message)
                response_json = json.loads(response_str)
                print(json.dumps(response_json, indent=2))
            except json.JSONDecodeError:
                # If the response is not valid JSON, print it as is
                print(response.message)
                
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run a catalog agent demo")
    parser.add_argument(
        "--agent", 
        type=str, 
        choices=["glue", "unity", "unified"], 
        default="unity",
        help="Type of agent to use (glue, unity, or unified)"
    )
    args = parser.parse_args()
    
    run_demo(args.agent)
