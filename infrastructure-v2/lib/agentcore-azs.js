"use strict";
/**
 * AgentCore Availability Zone Mappings
 *
 * AgentCore requires specific Availability Zones per region.
 * This module provides utilities to automatically select the correct AZs
 * based on the deployment region.
 *
 * Reference: https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore-requirements.html
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENTCORE_ZONE_IDS = void 0;
exports.getAgentCoreAzs = getAgentCoreAzs;
exports.getAgentCoreZoneIds = getAgentCoreZoneIds;
exports.isAgentCoreRegion = isAgentCoreRegion;
exports.getSupportedRegions = getSupportedRegions;
exports.getRegionConfigInstructions = getRegionConfigInstructions;
/**
 * AgentCore-compatible Zone IDs by region
 * For each region, specify the 3 Zone IDs that AgentCore supports
 */
exports.AGENTCORE_ZONE_IDS = {
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
function getAgentCoreAzs(region, contextAzs) {
    // If all AZs are explicitly configured via context, use those
    if (contextAzs?.az1 && contextAzs?.az2 && contextAzs?.az3) {
        return [contextAzs.az1, contextAzs.az2, contextAzs.az3];
    }
    // Otherwise, use the region-specific mappings
    const regionMapping = exports.AGENTCORE_ZONE_IDS[region];
    if (!regionMapping) {
        return undefined; // Region not configured
    }
    // Use fallback AZ names for the region
    return regionMapping
        .map(mapping => mapping.fallbackAzName)
        .filter((az) => az !== undefined);
}
/**
 * Get AgentCore Zone IDs for a region
 *
 * @param region - AWS region
 * @returns Array of Zone IDs, or undefined if region not configured
 */
function getAgentCoreZoneIds(region) {
    const regionMapping = exports.AGENTCORE_ZONE_IDS[region];
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
function isAgentCoreRegion(region) {
    return region in exports.AGENTCORE_ZONE_IDS;
}
/**
 * Get list of supported AgentCore regions
 *
 * @returns Array of supported region names
 */
function getSupportedRegions() {
    return Object.keys(exports.AGENTCORE_ZONE_IDS);
}
/**
 * Format instructions for configuring a new region
 *
 * @param region - AWS region to configure
 * @returns Instructions for adding the region
 */
function getRegionConfigInstructions(region) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRjb3JlLWF6cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFnZW50Y29yZS1henMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUE2Q0gsMENBdUJDO0FBUUQsa0RBTUM7QUFRRCw4Q0FFQztBQU9ELGtEQUVDO0FBUUQsa0VBcUJDO0FBM0hEOzs7R0FHRztBQUNVLFFBQUEsa0JBQWtCLEdBQXlDO0lBQ3RFLFdBQVcsRUFBRTtRQUNYLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFO1FBQ3BELEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFO1FBQ3BELEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFO0tBQ3JEO0lBQ0QsV0FBVyxFQUFFO1FBQ1gsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUU7UUFDcEQsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUU7UUFDcEQsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUU7S0FDckQ7SUFDRCxXQUFXLEVBQUU7UUFDWCxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRTtRQUNwRCxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRTtRQUNwRCxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRTtLQUNyRDtJQUNELDZCQUE2QjtDQUM5QixDQUFDO0FBRUY7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDSCxTQUFnQixlQUFlLENBQzdCLE1BQWMsRUFDZCxVQUlDO0lBRUQsOERBQThEO0lBQzlELElBQUksVUFBVSxFQUFFLEdBQUcsSUFBSSxVQUFVLEVBQUUsR0FBRyxJQUFJLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUMxRCxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRUQsOENBQThDO0lBQzlDLE1BQU0sYUFBYSxHQUFHLDBCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2pELElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNuQixPQUFPLFNBQVMsQ0FBQyxDQUFDLHdCQUF3QjtJQUM1QyxDQUFDO0lBRUQsdUNBQXVDO0lBQ3ZDLE9BQU8sYUFBYTtTQUNqQixHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDO1NBQ3RDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBZ0IsRUFBRSxDQUFDLEVBQUUsS0FBSyxTQUFTLENBQUMsQ0FBQztBQUNwRCxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFnQixtQkFBbUIsQ0FBQyxNQUFjO0lBQ2hELE1BQU0sYUFBYSxHQUFHLDBCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2pELElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNuQixPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBQ0QsT0FBTyxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RELENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILFNBQWdCLGlCQUFpQixDQUFDLE1BQWM7SUFDOUMsT0FBTyxNQUFNLElBQUksMEJBQWtCLENBQUM7QUFDdEMsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFnQixtQkFBbUI7SUFDakMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLDBCQUFrQixDQUFDLENBQUM7QUFDekMsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBZ0IsMkJBQTJCLENBQUMsTUFBYztJQUN4RCxPQUFPO1VBQ0MsTUFBTTs7Ozs0Q0FJNEIsTUFBTTtrREFDQSxNQUFNOzs7OztNQUtsRCxNQUFNOzs7Ozs7OztDQVFYLENBQUM7QUFDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBZ2VudENvcmUgQXZhaWxhYmlsaXR5IFpvbmUgTWFwcGluZ3NcbiAqIFxuICogQWdlbnRDb3JlIHJlcXVpcmVzIHNwZWNpZmljIEF2YWlsYWJpbGl0eSBab25lcyBwZXIgcmVnaW9uLlxuICogVGhpcyBtb2R1bGUgcHJvdmlkZXMgdXRpbGl0aWVzIHRvIGF1dG9tYXRpY2FsbHkgc2VsZWN0IHRoZSBjb3JyZWN0IEFac1xuICogYmFzZWQgb24gdGhlIGRlcGxveW1lbnQgcmVnaW9uLlxuICogXG4gKiBSZWZlcmVuY2U6IGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9iZWRyb2NrL2xhdGVzdC91c2VyZ3VpZGUvYWdlbnRjb3JlLXJlcXVpcmVtZW50cy5odG1sXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBBZ2VudENvcmVBek1hcHBpbmcge1xuICB6b25lSWQ6IHN0cmluZztcbiAgZmFsbGJhY2tBek5hbWU/OiBzdHJpbmc7IC8vIERlZmF1bHQgQVogbmFtZSBpZiBub3QgZm91bmRcbn1cblxuLyoqXG4gKiBBZ2VudENvcmUtY29tcGF0aWJsZSBab25lIElEcyBieSByZWdpb25cbiAqIEZvciBlYWNoIHJlZ2lvbiwgc3BlY2lmeSB0aGUgMyBab25lIElEcyB0aGF0IEFnZW50Q29yZSBzdXBwb3J0c1xuICovXG5leHBvcnQgY29uc3QgQUdFTlRDT1JFX1pPTkVfSURTOiBSZWNvcmQ8c3RyaW5nLCBBZ2VudENvcmVBek1hcHBpbmdbXT4gPSB7XG4gICd1cy1lYXN0LTEnOiBbXG4gICAgeyB6b25lSWQ6ICd1c2UxLWF6MScsIGZhbGxiYWNrQXpOYW1lOiAndXMtZWFzdC0xYScgfSxcbiAgICB7IHpvbmVJZDogJ3VzZTEtYXoyJywgZmFsbGJhY2tBek5hbWU6ICd1cy1lYXN0LTFiJyB9LFxuICAgIHsgem9uZUlkOiAndXNlMS1hejQnLCBmYWxsYmFja0F6TmFtZTogJ3VzLWVhc3QtMWQnIH0sXG4gIF0sXG4gICd1cy13ZXN0LTInOiBbXG4gICAgeyB6b25lSWQ6ICd1c3cyLWF6MScsIGZhbGxiYWNrQXpOYW1lOiAndXMtd2VzdC0yYScgfSxcbiAgICB7IHpvbmVJZDogJ3VzdzItYXoyJywgZmFsbGJhY2tBek5hbWU6ICd1cy13ZXN0LTJiJyB9LFxuICAgIHsgem9uZUlkOiAndXN3Mi1hejMnLCBmYWxsYmFja0F6TmFtZTogJ3VzLXdlc3QtMmMnIH0sXG4gIF0sXG4gICdldS13ZXN0LTEnOiBbXG4gICAgeyB6b25lSWQ6ICdldXcxLWF6MScsIGZhbGxiYWNrQXpOYW1lOiAnZXUtd2VzdC0xYScgfSxcbiAgICB7IHpvbmVJZDogJ2V1dzEtYXoyJywgZmFsbGJhY2tBek5hbWU6ICdldS13ZXN0LTFiJyB9LFxuICAgIHsgem9uZUlkOiAnZXV3MS1hejMnLCBmYWxsYmFja0F6TmFtZTogJ2V1LXdlc3QtMWMnIH0sXG4gIF0sXG4gIC8vIEFkZCBtb3JlIHJlZ2lvbnMgYXMgbmVlZGVkXG59O1xuXG4vKipcbiAqIEdldCBBZ2VudENvcmUtY29tcGF0aWJsZSBBWiBuYW1lcyBmb3IgYSByZWdpb25cbiAqIFxuICogVGhpcyBmdW5jdGlvbiByZXR1cm5zIHRoZSBBWiBuYW1lcyB0aGF0IGFyZSBjb21wYXRpYmxlIHdpdGggQWdlbnRDb3JlIGZvciB0aGUgZ2l2ZW4gcmVnaW9uLlxuICogXG4gKiBQcmlvcml0eTpcbiAqIDEuIFVzZXMgZXhwbGljaXRseSBjb25maWd1cmVkIEFacyBmcm9tIENESyBjb250ZXh0IChhZ2VudENvcmVBejEsIGFnZW50Q29yZUF6MiwgYWdlbnRDb3JlQXozKVxuICogMi4gRmFsbHMgYmFjayB0byBrbm93biBtYXBwaW5ncyBiYXNlZCBvbiBab25lIElEc1xuICogMy4gVXNlcyBmYWxsYmFjayBBWiBuYW1lcyBpZiBhdmFpbGFibGVcbiAqIDQuIFJldHVybnMgdW5kZWZpbmVkIGlmIHJlZ2lvbiBpcyBub3QgY29uZmlndXJlZCAod2lsbCB0cmlnZ2VyIGEgd2FybmluZyBpbiBOZXR3b3JrU3RhY2spXG4gKiBcbiAqIEBwYXJhbSByZWdpb24gLSBBV1MgcmVnaW9uIChlLmcuLCAndXMtZWFzdC0xJylcbiAqIEBwYXJhbSBjb250ZXh0QXpzIC0gT3B0aW9uYWwgZXhwbGljaXRseSBjb25maWd1cmVkIEFacyBmcm9tIENESyBjb250ZXh0XG4gKiBAcmV0dXJucyBBcnJheSBvZiAzIEFaIG5hbWVzIGNvbXBhdGlibGUgd2l0aCBBZ2VudENvcmUsIG9yIHVuZGVmaW5lZCBpZiByZWdpb24gbm90IGNvbmZpZ3VyZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEFnZW50Q29yZUF6cyhcbiAgcmVnaW9uOiBzdHJpbmcsXG4gIGNvbnRleHRBenM/OiB7XG4gICAgYXoxPzogc3RyaW5nO1xuICAgIGF6Mj86IHN0cmluZztcbiAgICBhejM/OiBzdHJpbmc7XG4gIH1cbik6IHN0cmluZ1tdIHwgdW5kZWZpbmVkIHtcbiAgLy8gSWYgYWxsIEFacyBhcmUgZXhwbGljaXRseSBjb25maWd1cmVkIHZpYSBjb250ZXh0LCB1c2UgdGhvc2VcbiAgaWYgKGNvbnRleHRBenM/LmF6MSAmJiBjb250ZXh0QXpzPy5hejIgJiYgY29udGV4dEF6cz8uYXozKSB7XG4gICAgcmV0dXJuIFtjb250ZXh0QXpzLmF6MSwgY29udGV4dEF6cy5hejIsIGNvbnRleHRBenMuYXozXTtcbiAgfVxuXG4gIC8vIE90aGVyd2lzZSwgdXNlIHRoZSByZWdpb24tc3BlY2lmaWMgbWFwcGluZ3NcbiAgY29uc3QgcmVnaW9uTWFwcGluZyA9IEFHRU5UQ09SRV9aT05FX0lEU1tyZWdpb25dO1xuICBpZiAoIXJlZ2lvbk1hcHBpbmcpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkOyAvLyBSZWdpb24gbm90IGNvbmZpZ3VyZWRcbiAgfVxuXG4gIC8vIFVzZSBmYWxsYmFjayBBWiBuYW1lcyBmb3IgdGhlIHJlZ2lvblxuICByZXR1cm4gcmVnaW9uTWFwcGluZ1xuICAgIC5tYXAobWFwcGluZyA9PiBtYXBwaW5nLmZhbGxiYWNrQXpOYW1lKVxuICAgIC5maWx0ZXIoKGF6KTogYXogaXMgc3RyaW5nID0+IGF6ICE9PSB1bmRlZmluZWQpO1xufVxuXG4vKipcbiAqIEdldCBBZ2VudENvcmUgWm9uZSBJRHMgZm9yIGEgcmVnaW9uXG4gKiBcbiAqIEBwYXJhbSByZWdpb24gLSBBV1MgcmVnaW9uXG4gKiBAcmV0dXJucyBBcnJheSBvZiBab25lIElEcywgb3IgdW5kZWZpbmVkIGlmIHJlZ2lvbiBub3QgY29uZmlndXJlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QWdlbnRDb3JlWm9uZUlkcyhyZWdpb246IHN0cmluZyk6IHN0cmluZ1tdIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgcmVnaW9uTWFwcGluZyA9IEFHRU5UQ09SRV9aT05FX0lEU1tyZWdpb25dO1xuICBpZiAoIXJlZ2lvbk1hcHBpbmcpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiByZWdpb25NYXBwaW5nLm1hcChtYXBwaW5nID0+IG1hcHBpbmcuem9uZUlkKTtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhIHJlZ2lvbiBpcyBjb25maWd1cmVkIGZvciBBZ2VudENvcmVcbiAqIFxuICogQHBhcmFtIHJlZ2lvbiAtIEFXUyByZWdpb25cbiAqIEByZXR1cm5zIHRydWUgaWYgcmVnaW9uIGhhcyBBZ2VudENvcmUgY29uZmlndXJhdGlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNBZ2VudENvcmVSZWdpb24ocmVnaW9uOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHJlZ2lvbiBpbiBBR0VOVENPUkVfWk9ORV9JRFM7XG59XG5cbi8qKlxuICogR2V0IGxpc3Qgb2Ygc3VwcG9ydGVkIEFnZW50Q29yZSByZWdpb25zXG4gKiBcbiAqIEByZXR1cm5zIEFycmF5IG9mIHN1cHBvcnRlZCByZWdpb24gbmFtZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFN1cHBvcnRlZFJlZ2lvbnMoKTogc3RyaW5nW10ge1xuICByZXR1cm4gT2JqZWN0LmtleXMoQUdFTlRDT1JFX1pPTkVfSURTKTtcbn1cblxuLyoqXG4gKiBGb3JtYXQgaW5zdHJ1Y3Rpb25zIGZvciBjb25maWd1cmluZyBhIG5ldyByZWdpb25cbiAqIFxuICogQHBhcmFtIHJlZ2lvbiAtIEFXUyByZWdpb24gdG8gY29uZmlndXJlXG4gKiBAcmV0dXJucyBJbnN0cnVjdGlvbnMgZm9yIGFkZGluZyB0aGUgcmVnaW9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZWdpb25Db25maWdJbnN0cnVjdGlvbnMocmVnaW9uOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYFxuUmVnaW9uICcke3JlZ2lvbn0nIGlzIG5vdCBjb25maWd1cmVkIGZvciBBZ2VudENvcmUuXG5cblRvIGFkZCBzdXBwb3J0IGZvciB0aGlzIHJlZ2lvbjpcblxuMS4gRmluZCBBZ2VudENvcmUtY29tcGF0aWJsZSBab25lIElEcyBmb3IgJHtyZWdpb259OlxuICAgYXdzIGVjMiBkZXNjcmliZS1hdmFpbGFiaWxpdHktem9uZXMgLS1yZWdpb24gJHtyZWdpb259IFxcXFxcbiAgICAgLS1xdWVyeSBcIkF2YWlsYWJpbGl0eVpvbmVzWypdLltab25lTmFtZSwgWm9uZUlkLCBTdGF0ZV1cIiBcXFxcXG4gICAgIC0tb3V0cHV0IHRhYmxlXG5cbjIuIEFkZCB0aGUgY29uZmlndXJhdGlvbiB0byBsaWIvYWdlbnRjb3JlLWF6cy50czpcbiAgICcke3JlZ2lvbn0nOiBbXG4gICAgIHsgem9uZUlkOiAnPHpvbmUtaWQtMT4nLCBmYWxsYmFja0F6TmFtZTogJzxhei1uYW1lLTE+JyB9LFxuICAgICB7IHpvbmVJZDogJzx6b25lLWlkLTI+JywgZmFsbGJhY2tBek5hbWU6ICc8YXotbmFtZS0yPicgfSxcbiAgICAgeyB6b25lSWQ6ICc8em9uZS1pZC0zPicsIGZhbGxiYWNrQXpOYW1lOiAnPGF6LW5hbWUtMz4nIH0sXG4gICBdLFxuXG4zLiBPciBvdmVycmlkZSB2aWEgQ0RLIGNvbnRleHQ6XG4gICBucHggY2RrIGRlcGxveSAtYyBhZ2VudENvcmVBejE9PGF6MT4gLWMgYWdlbnRDb3JlQXoyPTxhejI+IC1jIGFnZW50Q29yZUF6Mz08YXozPlxuYDtcbn1cbiJdfQ==