import type { McpProtocolVersion } from './versions.js';

/** JSON-RPC error codes this server emits, including the MCP-reserved sub-range. */
export enum JsonRpcErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
    HeaderMismatch = -32020,
    MissingRequiredClientCapability = -32021,
    UnsupportedProtocolVersion = -32022,
}

export type JsonRpcId = string | number;

/** A single client-to-server JSON-RPC message, after shape validation. */
export type JsonRpcRequest = {
    jsonrpc: '2.0';
    /** Absent on a notification, which takes no response. */
    id?: JsonRpcId;
    method: string;
    params?: Record<string, unknown>;
};

export type JsonRpcResultResponse = {
    jsonrpc: '2.0';
    id: JsonRpcId;
    result: Record<string, unknown>;
};

export type JsonRpcErrorResponse = {
    jsonrpc: '2.0';
    id: JsonRpcId | null;
    error: { code: JsonRpcErrorCode; message: string; data?: Record<string, unknown> };
};

export type JsonRpcResponse = JsonRpcResultResponse | JsonRpcErrorResponse;

/** Build a JSON-RPC error response. */
export function jsonRpcError({
    id,
    code,
    message,
    data,
}: {
    id: JsonRpcId | null;
    code: JsonRpcErrorCode;
    message: string;
    data?: Record<string, unknown>;
}): JsonRpcErrorResponse {
    return { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } };
}

/** Build the `UnsupportedProtocolVersion` error, which carries the versions this server accepts. */
export function unsupportedProtocolVersionError({
    id,
    requested,
    supported,
}: {
    id: JsonRpcId | null;
    requested: string;
    supported: McpProtocolVersion[];
}): JsonRpcErrorResponse {
    return jsonRpcError({
        id,
        code: JsonRpcErrorCode.UnsupportedProtocolVersion,
        message: `Unsupported protocol version: ${requested}`,
        data: { requested, supported },
    });
}

/** Narrow an unvalidated request body to a single JSON-RPC request or notification. */
export function parseJsonRpcRequest(body: unknown): JsonRpcRequest | null {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;

    const message = body as Record<string, unknown>;

    if (message['jsonrpc'] !== '2.0') return null;

    if (typeof message['method'] !== 'string') return null;

    const id = message['id'];

    if (id !== undefined && typeof id !== 'string' && typeof id !== 'number') return null;

    const params = message['params'];

    if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) return null;

    return {
        jsonrpc: '2.0',
        ...(id === undefined ? {} : { id }),
        method: message['method'],
        ...(params === undefined ? {} : { params: params as Record<string, unknown> }),
    };
}
