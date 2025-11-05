#!/usr/bin/env python3
from agents.unified_catalog_agent import unified_agent

def test_unified_agent():
    try:
        print("Testing unified agent with AgentCore endpoints...")
        response = unified_agent("List all databases in both catalogs")
        print("Response:", str(response.message))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_unified_agent()
