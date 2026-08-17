/** MCP protocol revisions this server speaks, newest first. */
export enum McpProtocolVersion {
    V2026_07_28 = '2026-07-28',
    V2025_11_25 = '2025-11-25',
    V2025_06_18 = '2025-06-18',
    V2025_03_26 = '2025-03-26',
}

export const SUPPORTED_PROTOCOL_VERSIONS: McpProtocolVersion[] = [
    McpProtocolVersion.V2026_07_28,
    McpProtocolVersion.V2025_11_25,
    McpProtocolVersion.V2025_06_18,
    McpProtocolVersion.V2025_03_26,
];

/**
 * Version assumed when a request carries no `MCP-Protocol-Version` header. The header was
 * introduced in 2025-06-18, so its absence identifies a client from before that revision
 * (2026-07-28 Streamable HTTP, "Protocol Version Header").
 */
export const ASSUMED_PROTOCOL_VERSION = McpProtocolVersion.V2025_03_26;

/** Header carrying the protocol revision of a single request. */
export const PROTOCOL_VERSION_HEADER = 'mcp-protocol-version';

/** Returns true when this server implements the given protocol revision. */
export function isSupportedProtocolVersion(version: string): version is McpProtocolVersion {
    return (SUPPORTED_PROTOCOL_VERSIONS as string[]).includes(version);
}

/**
 * Returns true for revisions that carry protocol metadata on every request rather than
 * establishing it through an `initialize` handshake.
 */
export function isPerRequestMetadataVersion(version: McpProtocolVersion): boolean {
    return version === McpProtocolVersion.V2026_07_28;
}
