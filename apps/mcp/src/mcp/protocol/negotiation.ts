import {
    ASSUMED_PROTOCOL_VERSION,
    isSupportedProtocolVersion,
    McpProtocolVersion,
    PROTOCOL_VERSION_HEADER,
} from './versions.js';

export type NegotiatedVersion = { ok: true; version: McpProtocolVersion } | { ok: false; requested: string };

/**
 * Determine which protocol revision a request is speaking from its `MCP-Protocol-Version` header.
 *
 * An absent header identifies a client from before 2025-06-18, which is the revision that
 * introduced it.
 */
export function negotiateProtocolVersion(
    headers: Record<string, string | string[] | undefined>,
): NegotiatedVersion {
    const raw = headers[PROTOCOL_VERSION_HEADER];
    const requested = Array.isArray(raw) ? raw[0] : raw;

    if (requested === undefined) return { ok: true, version: ASSUMED_PROTOCOL_VERSION };

    if (!isSupportedProtocolVersion(requested)) return { ok: false, requested };

    return { ok: true, version: requested };
}
