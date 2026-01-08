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
  fallbackAzName?: string; // Default AZ name if not found
}

/**
 * AgentCore-compatible Zone IDs by region
 * For each region, specify the 3 Zone IDs that AgentCore supports
 */
export const AGENTCORE_ZONE_IDS: Record<string, AgentCoreAzMapping[]> = {
  'us-east-1': [
    { zoneId: 'use1-az1', fallbackAzName: 'us-east-1a' },
    { zoneId: 'use1-az2', fallbackAzName: 'us-east-1b' },
    { zoneId: 'use1-az4', fallbackAzName: 'us-east-1d' },
  ],
  'us-west-2': [
    { zoneId: 'usw2-az1', fallbackAzName: 'us-west-2a' },
    { zoneId: 'usw2-az2', fallbackAzName: 'us-west-2b' },
    { zoneId: 'usw2-az3', fallbackAzName: 'us-west-2c' },
  ],
  'eu-west-1': [
    { zoneId: 'euw1-az1', fallbackAzName: 'eu-west-1a' },
    { zoneId: 'euw1-az2', fallbackAzName: 'eu-west-1b' },
    { zoneId: 'euw1-az3', fallbackAzName: 'eu-west-1c' },
  ],
  // Add more regions as needed
};

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
export function getAgentCoreAzs(
  region: string,
  contextAzs?: {
    az1?: string;
    az2?: string;
    az3?: string;
  }
): string[] | undefined {
  // If all AZs are explicitly configured via context, use those
  if (contextAzs?.az1 && contextAzs?.az2 && contextAzs?.az3) {
    return [contextAzs.az1, contextAzs.az2, contextAzs.az3];
  }

  // Otherwise, use the region-specific mappings
  const regionMapping = AGENTCORE_ZONE_IDS[region];
  if (!regionMapping) {
    return undefined; // Region not configured
  }

  // Use fallback AZ names for the region
  return regionMapping
    .map(mapping => mapping.fallbackAzName)
    .filter((az): az is string => az !== undefined);
}

/**
 * Get AgentCore Zone IDs for a region
 * 
 * @param region - AWS region
 * @returns Array of Zone IDs, or undefined if region not configured
 */
export function getAgentCoreZoneIds(region: string): string[] | undefined {
  const regionMapping = AGENTCORE_ZONE_IDS[region];
  if (!regionMapping) {
    return undefined;
  }
  return regionMapping.map(mapping => mapping.zoneId);
}

/**
 * Check if a region is configured for AgentCore
 * 
 * @param region - AWS region
 * @returns true if region has AgentCore configuration
 */
export function isAgentCoreRegion(region: string): boolean {
  return region in AGENTCORE_ZONE_IDS;
}

/**
 * Get list of supported AgentCore regions
 * 
 * @returns Array of supported region names
 */
export function getSupportedRegions(): string[] {
  return Object.keys(AGENTCORE_ZONE_IDS);
}

/**
 * Format instructions for configuring a new region
 * 
 * @param region - AWS region to configure
 * @returns Instructions for adding the region
 */
export function getRegionConfigInstructions(region: string): string {
  return `
Region '${region}' is not configured for AgentCore.

To add support for this region:

1. Find AgentCore-compatible Zone IDs for ${region}:
   aws ec2 describe-availability-zones --region ${region} \\
     --query "AvailabilityZones[*].[ZoneName, ZoneId, State]" \\
     --output table

2. Add the configuration to lib/agentcore-azs.ts:
   '${region}': [
     { zoneId: '<zone-id-1>', fallbackAzName: '<az-name-1>' },
     { zoneId: '<zone-id-2>', fallbackAzName: '<az-name-2>' },
     { zoneId: '<zone-id-3>', fallbackAzName: '<az-name-3>' },
   ],

3. Or override via CDK context:
   npx cdk deploy -c agentCoreAz1=<az1> -c agentCoreAz2=<az2> -c agentCoreAz3=<az3>
`;
}
