# Product Context

## Purpose
This project demonstrates how customers who use both Databricks and AWS can leverage a multi-agent system to work more effectively across both environments. It addresses the common challenge of data being distributed across different platforms (Databricks and AWS) by providing a unified interface for data discovery.

## Problem Statement
Organizations often store data across multiple platforms, making it difficult for users to:
- Know where specific data resides
- Access data efficiently without switching between different interfaces
- Maintain a comprehensive view of all available data assets

## Solution
A multi-agent system that:
- Abstracts away the complexity of working with multiple data catalogs
- Provides a unified interface for data discovery
- Enables users to locate data regardless of which platform it resides in

## User Experience Goals
- Seamless data discovery across Databricks Unity Catalog and AWS Glue Catalog
- Natural language queries to find relevant data
- Consistent response format regardless of data source
- Simplified access to metadata from both platforms

## Target Users
- Data engineers working across Databricks and AWS environments
- Data scientists who need to discover and access data from multiple sources
- Analysts who need to query data without deep knowledge of the underlying platforms

## Success Criteria
- Agents can successfully query both Unity Catalog and AWS Glue Catalog
- Supervisor agent can coordinate between specialized agents to provide unified responses
- Demo runs locally without requiring actual Databricks access
- System provides accurate and helpful responses to data discovery queries
