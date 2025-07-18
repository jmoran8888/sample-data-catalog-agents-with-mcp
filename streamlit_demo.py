#!/usr/bin/env python3
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""
Unified Catalog Agent Streamlit Demo

This Streamlit application demonstrates the usage of the unified catalog agent
that can query both Unity Catalog and AWS Glue Catalog.
"""

import json
import logging
import streamlit as st
from agents.unified_catalog_agent import unified_agent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Page configuration
st.set_page_config(
    page_title="Unified Catalog Agent Demo",
    page_icon="📊",
    layout="wide"
)

def display_table(data):
    """Display data as a table if it's a list of dictionaries"""
    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
        st.dataframe(data)
    else:
        st.json(data)

def main():
    """Main function to run the Streamlit app"""
    
    # Header
    st.title("Unified Catalog Agent Demo")
    st.markdown("""
    This demo showcases the unified catalog agent that can query both Unity Catalog and AWS Glue Catalog.
    
    The agent uses MCP (Model Context Protocol) to interact with both catalog agents and provides a unified interface for data discovery.
    """)
    
    # Warning about MCP servers
    st.warning("""
    **Important**: Make sure you have built the MCP servers before running this demo:
    
    ```
    # Build Unity catalog MCP server
    cd mcp/unity-catalog-server
    npm install
    npm run build
    cd ../..
    
    # Build AWS Glue catalog MCP server
    cd mcp/glue-catalog-server
    npm install
    npm run build
    cd ../..
    ```
    """)
    
    # Example queries
    with st.expander("Example queries", expanded=True):
        st.markdown("""
        - List all databases in both catalogs
        - Find tables with 'customer' in the name in both catalogs
        - Show me all tables in the Unity catalog
        - Show me all tables in the AWS Glue catalog
        - Find tables with columns containing 'timestamp' across both catalogs
        - Get details for table 'orders' in both catalogs
        """)
    
    # Query input
    query = st.text_area("Enter your query:", height=100)
    submit = st.button("Submit Query")
    
    # Process query
    if submit and query:
        with st.spinner("Processing query... This may take a moment as the MCP servers initialize."):
            try:
                # Call the unified agent
                response = unified_agent(query)
                
                # Get the response as a string
                response_str = str(response.message)
                
                # Display results
                st.subheader("Results")
                
                # Try to parse as JSON, but don't fail if it's not valid JSON
                try:
                    response_json = json.loads(response_str)
                    
                    # If JSON parsing succeeded, we can display structured data
                    
                    # Display summary if available
                    if "summary" in response_json:
                        st.info(response_json["summary"])
                    
                    # Check if clarification is needed
                    if "clarification_needed" in response_json and response_json["clarification_needed"]:
                        st.warning(f"**Clarification needed**: {response_json['clarification_question']}")
                    
                    # Create tabs for different result views
                    tab1, tab2, tab3 = st.tabs(["Unity Results", "Glue Results", "Raw Response"])
                    
                    # Display Unity results
                    with tab1:
                        if "unity_results" in response_json and response_json["unity_results"]:
                            st.subheader("Unity Catalog Results")
                            display_table(response_json["unity_results"])
                        else:
                            st.info("No Unity Catalog results available for this query.")
                    
                    # Display Glue results
                    with tab2:
                        if "glue_results" in response_json and response_json["glue_results"]:
                            st.subheader("AWS Glue Catalog Results")
                            display_table(response_json["glue_results"])
                        else:
                            st.info("No AWS Glue Catalog results available for this query.")
                    
                    # Raw response
                    with tab3:
                        st.subheader("Raw Response")
                        st.text(response_str)
                
                except json.JSONDecodeError:
                    # If JSON parsing failed, just display the raw response
                    st.text_area("Agent Response", response_str, height=400)
                    
            except Exception as e:
                st.error(f"Error: {e}")
                st.info("Make sure you have built the MCP servers before running this demo. See the instructions above.")

if __name__ == "__main__":
    main()
