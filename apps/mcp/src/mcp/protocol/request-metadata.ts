import type { JsonRpcRequest } from './json-rpc.js';
import { PROTOCOL_VERSION_HEADER } from './versions.js';

/** Reserved `_meta` keys carrying per-request protocol metadata. */
export enum RequestMetaKey {
    ProtocolVersion = 'io.modelcontextprotocol/protocolVersion',
    ClientInfo = 'io.modelcontextprotocol/clientInfo',
    ClientCapabilities = 'io.modelcontextprotocol/clientCapabilities',
}

/** `_meta` key a result carries to identify the server that produced it. */
export const SERVER_INFO_META_KEY = 'io.modelcontextprotocol/serverInfo';

export const METHOD_HEADER = 'mcp-method';
export const NAME_HEADER = 'mcp-name';

/** Methods whose `Mcp-Name` header mirrors a body value. */
const NAME_HEADER_METHODS: Record<string, 'name' | 'uri'> = {
    'tools/call': 'name',
    'prompts/get': 'name',
    'resources/read': 'uri',
};

const BASE64_SENTINEL_PREFIX = '=?base64?';
const BASE64_SENTINEL_SUFFIX = '?=';

export type MetadataProblem = { message: string };

/**
 * Check the mirrored HTTP headers against the request body.
 *
 * An intermediary may route on the header while this server executes on the body, so a
 * disagreement between the two is rejected rather than resolved.
 */
export function validateMirroredHeaders({
    headers,
    request,
}: {
    headers: Record<string, string | string[] | undefined>;
    request: JsonRpcRequest;
}): MetadataProblem | null {
    const version = headerValue({ headers, name: PROTOCOL_VERSION_HEADER });
    const bodyVersion = metaValue({ request, key: RequestMetaKey.ProtocolVersion });

    if (version !== bodyVersion) {
        return { message: `MCP-Protocol-Version header value '${version}' does not match body value '${bodyVersion}'` };
    }

    const method = headerValue({ headers, name: METHOD_HEADER });

    if (method === undefined) return { message: 'Mcp-Method header is required' };

    if (method !== request.method) {
        return { message: `Mcp-Method header value '${method}' does not match body value '${request.method}'` };
    }

    return validateNameHeader({ headers, request });
}

/** Required `_meta` fields, per 2026-07-28 "Per-request protocol fields". */
export function validateRequestMeta(request: JsonRpcRequest): MetadataProblem | null {
    const meta = requestMeta(request);

    if (typeof meta[RequestMetaKey.ProtocolVersion] !== 'string') {
        return { message: `params._meta['${RequestMetaKey.ProtocolVersion}'] is required` };
    }

    const capabilities = meta[RequestMetaKey.ClientCapabilities];

    if (typeof capabilities !== 'object' || capabilities === null || Array.isArray(capabilities)) {
        return { message: `params._meta['${RequestMetaKey.ClientCapabilities}'] is required` };
    }

    return null;
}

/** The client's self-reported name and version, for logging only. */
export function clientInfoOf(request: JsonRpcRequest): { name?: string; version?: string } {
    const info = requestMeta(request)[RequestMetaKey.ClientInfo];

    if (typeof info !== 'object' || info === null) return {};

    const { name, version } = info as Record<string, unknown>;

    return {
        ...(typeof name === 'string' ? { name } : {}),
        ...(typeof version === 'string' ? { version } : {}),
    };
}

/**
 * Decode a header value that may carry the Base64 sentinel encoding clients use for values that
 * are not safely representable as ASCII. Returns null when the sentinel is present but malformed.
 */
export function decodeHeaderValue(value: string): string | null {
    if (!value.startsWith(BASE64_SENTINEL_PREFIX) || !value.endsWith(BASE64_SENTINEL_SUFFIX)) return value;

    const encoded = value.slice(BASE64_SENTINEL_PREFIX.length, -BASE64_SENTINEL_SUFFIX.length);
    const decoded = Buffer.from(encoded, 'base64');

    // Base64 decoding accepts input it cannot round-trip, so the re-encoding is the real check.
    if (decoded.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) return null;

    return decoded.toString('utf8');
}

function validateNameHeader({
    headers,
    request,
}: {
    headers: Record<string, string | string[] | undefined>;
    request: JsonRpcRequest;
}): MetadataProblem | null {
    const source = NAME_HEADER_METHODS[request.method];

    if (!source) return null;

    const raw = headerValue({ headers, name: NAME_HEADER });

    if (raw === undefined) return { message: `Mcp-Name header is required for ${request.method}` };

    const name = decodeHeaderValue(raw);

    if (name === null) return { message: 'Mcp-Name header is not valid Base64 sentinel encoding' };

    const bodyName = request.params?.[source];

    if (name !== bodyName) {
        return { message: `Mcp-Name header value '${name}' does not match body value '${String(bodyName)}'` };
    }

    return null;
}

function requestMeta(request: JsonRpcRequest): Record<string, unknown> {
    const meta = request.params?.['_meta'];

    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return {};

    return meta as Record<string, unknown>;
}

function metaValue({ request, key }: { request: JsonRpcRequest; key: RequestMetaKey }): string | undefined {
    const value = requestMeta(request)[key];

    return typeof value === 'string' ? value : undefined;
}

function headerValue({
    headers,
    name,
}: {
    headers: Record<string, string | string[] | undefined>;
    name: string;
}): string | undefined {
    const value = headers[name];

    return Array.isArray(value) ? value[0] : value;
}
