"""
Unified Catalog Agent with Fallback

This module provides a fallback version that uses direct agent calls when MCP servers fail.
"""

import os
import logging
from strands import Agent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

def create_unified_agent_fallback():
    """Create unified agent with fallback to direct agent calls"""
    
    try:
        # Try to import and use the MCP version first
        from agents.unified_catalog_agent import unified_agent
        return unified_agent
    except Exception as e:
        logging.warning(f"MCP version failed, using fallback: {e}")
        
        # Fallback to direct agent calls
        from agents.glue_catalog_agent import glue_agent
        from agents.unity_catalog_agent import unity_agent
        
        # Update Unity agent URL from environment
        unity_url = os.getenv("UNITY_CATALOG_URL", "http://localhost:8080/api/2.1/unity-catalog")
        if hasattr(unity_agent, 'tools') and len(unity_agent.tools) > 0:
            unity_agent.tools[0].unity_catalog_url = unity_url
        
        # Create a simple unified agent that delegates to both
        class UnifiedAgent:
            def run(self, query):
                results = {
                    "query": query,
                    "unity_results": None,
                    "glue_results": None,
                    "summary": ""
                }
                
                # Try Unity Catalog
                try:
                    unity_result = unity_agent.run(query)
                    results["unity_results"] = unity_result.data
                except Exception as e:
                    logging.error(f"Unity catalog error: {e}")
                    results["unity_results"] = {"error": str(e)}
                
                # Try Glue Catalog
                try:
                    glue_result = glue_agent.run(query)
                    results["glue_results"] = glue_result.data
                except Exception as e:
                    logging.error(f"Glue catalog error: {e}")
                    results["glue_results"] = {"error": str(e)}
                
                # Create summary
                if results["unity_results"] and results["glue_results"]:
                    results["summary"] = "Retrieved data from both Unity and Glue catalogs"
                elif results["unity_results"]:
                    results["summary"] = "Retrieved data from Unity catalog only"
                elif results["glue_results"]:
                    results["summary"] = "Retrieved data from Glue catalog only"
                else:
                    results["summary"] = "Unable to retrieve data from either catalog"
                
                # Return in expected format
                class Result:
                    def __init__(self, data):
                        self.data = data
                
                return Result(results)
        
        return UnifiedAgent()

# Create the unified agent instance
unified_agent = create_unified_agent_fallback()
