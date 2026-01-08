"""
Lambda proxy function to invoke AgentCore Runtime for MCP servers
"""
import json
import boto3
import os
import logging
from typing import Dict, Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize boto3 client
bedrock_agentcore = boto3.client('bedrock-agentcore')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Proxy Lambda to invoke AgentCore Runtime
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    try:
        runtime_arn = os.environ['RUNTIME_ARN']
        
        logger.info(f"Invoking AgentCore Runtime: {runtime_arn}")
        logger.info(f"Event: {json.dumps(event)}")
        
        # Extract request body
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body) if body else {}
        
        # Extract path parameters and query strings
        path_parameters = event.get('pathParameters', {})
        query_parameters = event.get('queryStringParameters', {})
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        
        # Prepare input for AgentCore Runtime
        runtime_input = {
            'method': http_method,
            'path': path,
            'pathParameters': path_parameters,
            'queryParameters': query_parameters,
            'body': body,
        }
        
        # Invoke AgentCore Runtime
        response = bedrock_agentcore.invoke_agent_runtime(
            agentRuntimeArn=runtime_arn,
            inputText=json.dumps(runtime_input),
        )
        
        # Parse response
        runtime_response = json.loads(response.get('completion', '{}'))
        
        logger.info(f"Runtime response: {json.dumps(runtime_response)}")
        
        return {
            'statusCode': 200,
            'body': json.dumps(runtime_response),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            }
        }
        
    except Exception as e:
        logger.error(f"Error invoking AgentCore Runtime: {str(e)}", exc_info=True)
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal Server Error',
                'message': str(e),
            }),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        }
