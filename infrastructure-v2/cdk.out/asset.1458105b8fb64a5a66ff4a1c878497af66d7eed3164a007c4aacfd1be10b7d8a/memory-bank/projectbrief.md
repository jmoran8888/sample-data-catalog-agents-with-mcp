# Overview

This project builds a multi-agent demo using Databricks, Strands, MCP, and Bedrock.

This demo should show how customers who use both Databricks and AWS can use a multi-agent
system to help them work more effectively across both environments. Specifically, if a customer
has some data in Databricks and some data in AWS, we will use three agents:

* An agent that knows how to find information in the Unity catalog
* An agent that knows how to find information in the AWS Glue catalog
* A third agent that pulls information from those two agents to help a customer locate data, no matter which platform the data lives in.

The demo should use these technologies:

* The AWS Strands SDK to build the agents
* Amazon Bedrock to provide the LLMs that the agents use
* MCP to wrap the 'worker' agents as tools that the supervisor agent uses

The demo should run locally as a Python script or Jupyter notebook. 

We can assume that we have access to a Glue catalog in the AWS account that is configured for us. 
The AWS credentials will be set already in the local environment, so boto3 access just works.

We will run a local copy of the Unity catalog for the demo. We won't use any real Databricks access.