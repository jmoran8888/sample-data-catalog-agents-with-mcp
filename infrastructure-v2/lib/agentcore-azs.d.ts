/**
 * AgentCore Availability Zone Mappings
 *
 * AgentCore requires specific Availability Zones per region.
 * This module provides utilities to automatically select the correct AZs
 * based on the deployment region.
 *
 * Reference: https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore-requirements.html
 */
export interface AgentCoreAzMapping {
    zoneId: string;
    fallbackAzName?: string;
}
/**
 * AgentCore-compatible Zone IDs by region
 * For each region, specify the 3 Zone IDs that AgentCore supports
 */
export declare const AGENTCORE_ZONE_IDS: Record<string, AgentCoreAzMapping[]>;
/**
 * Get AgentCore-compatible AZ names for a region
 *
 * This function returns the AZ names that are compatible with AgentCore for the given region.
 *
 * Priority:
 * 1. Uses explicitly configured AZs from CDK context (agentCoreAz1, agentCoreAz2, agentCoreAz3)
 * 2. Falls back to known mappings based on Zone IDs
 * 3. Uses fallback AZ names if available
 * 4. Returns undefined if region is not configured (will trigger a warning in NetworkStack)
 *
 * @param region - AWS region (e.g., 'us-east-1')
 * @param contextAzs - Optional explicitly configured AZs from CDK context
 * @returns Array of 3 AZ names compatible with AgentCore, or undefined if region not configured
 */
export declare function getAgentCoreAzs(region: string, contextAzs?: {
    az1?: string;
    az2?: string;
    az3?: string;
}): string[] | undefined;
/**
 * Get AgentCore Zone IDs for a region
 *
 * @param region - AWS region
 * @returns Array of Zone IDs, or undefined if region not configured
 */
export declare function getAgentCoreZoneIds(region: string): string[] | undefined;
/**
 * Check if a region is configured for AgentCore
 *
 * @param region - AWS region
 * @returns true if region has AgentCore configuration
 */
export declare function isAgentCoreRegion(region: string): boolean;
/**
 * Get list of supported AgentCore regions
 *
 * @returns Array of supported region names
 */
export declare function getSupportedRegions(): string[];
/**
 * Format instructions for configuring a new region
 *
 * @param region - AWS region to configure
 * @returns Instructions for adding the region
 */
export declare function getRegionConfigInstructions(region: string): string;
