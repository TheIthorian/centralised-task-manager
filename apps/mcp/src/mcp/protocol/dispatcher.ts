import {
    JsonRpcErrorCode,
    type JsonRpcRequest,
    type JsonRpcResponse,
    jsonRpcError,
    parseJsonRpcRequest,
} from './json-rpc.js';
import {
    SERVER_INFO_META_KEY,
    validateMirroredHeaders,
    validateRequestMeta,
} from './request-metadata.js';
import type { ToolRegistry } from './tool-registry.js';

/** How long a client may treat a `tools/list` result as fresh. */
export const TOOL_LIST_TTL_MS = 5 * 60 * 1000;

/** The tool list is the same for every caller, so any cache may serve it to any of them. */
const TOOL_LIST_CACHE_SCOPE = 'public';

export type Implementation = { name: string; version: string };

/** What the transport should send back. A notification is accepted with no body. */
export type DispatchResult = { status: number; body?: JsonRpcResponse };

/**
 * Handles a single `2026-07-28` request.
 *
 * The revision dropped the `initialize` handshake and protocol-level sessions, so each request
 * carries its own metadata and is answered without reference to any other.
 */
export class StatelessDispatcher {
    constructor(
        private readonly tools: ToolRegistry,
        private readonly serverInfo: Implementation,
    ) {}

    /** Validate and answer one JSON-RPC message posted to the MCP endpoint. */
    async dispatch({
        headers,
        body,
    }: {
        headers: Record<string, string | string[] | undefined>;
        body: unknown;
    }): Promise<DispatchResult> {
        const request = parseJsonRpcRequest(body);

        if (!request) {
            return {
                status: 400,
                body: jsonRpcError({
                    id: null,
                    code: JsonRpcErrorCode.InvalidRequest,
                    message: 'Body is not a single JSON-RPC request or notification',
                }),
            };
        }

        const id = request.id ?? null;

        const metaProblem = validateRequestMeta(request);

        if (metaProblem) {
            return {
                status: 400,
                body: jsonRpcError({ id, code: JsonRpcErrorCode.InvalidParams, message: metaProblem.message }),
            };
        }

        const headerProblem = validateMirroredHeaders({ headers, request });

        if (headerProblem) {
            return {
                status: 400,
                body: jsonRpcError({
                    id,
                    code: JsonRpcErrorCode.HeaderMismatch,
                    message: `Header mismatch: ${headerProblem.message}`,
                }),
            };
        }

        if (request.id === undefined) return { status: 202 };

        return this.invoke({ request, id: request.id });
    }

    private async invoke({ request, id }: { request: JsonRpcRequest; id: string | number }): Promise<DispatchResult> {
        if (request.method === 'tools/list') {
            return {
                status: 200,
                body: {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        resultType: 'complete',
                        tools: this.tools.list(),
                        ttlMs: TOOL_LIST_TTL_MS,
                        cacheScope: TOOL_LIST_CACHE_SCOPE,
                        _meta: { [SERVER_INFO_META_KEY]: this.serverInfo },
                    },
                },
            };
        }

        if (request.method === 'tools/call') return this.callTool({ request, id });

        return {
            status: 404,
            body: jsonRpcError({
                id,
                code: JsonRpcErrorCode.MethodNotFound,
                message: `Method not found: ${request.method}`,
            }),
        };
    }

    private async callTool({
        request,
        id,
    }: {
        request: JsonRpcRequest;
        id: string | number;
    }): Promise<DispatchResult> {
        const name = request.params?.['name'];

        if (typeof name !== 'string' || !this.tools.has(name)) {
            return {
                status: 200,
                body: jsonRpcError({
                    id,
                    code: JsonRpcErrorCode.InvalidParams,
                    message: `Unknown tool: ${String(name)}`,
                }),
            };
        }

        const args = request.params?.['arguments'];
        const result = await this.tools.call({
            name,
            args: typeof args === 'object' && args !== null && !Array.isArray(args)
                ? (args as Record<string, unknown>)
                : {},
        });

        return {
            status: 200,
            body: {
                jsonrpc: '2.0',
                id,
                result: {
                    resultType: 'complete',
                    ...result,
                    _meta: { [SERVER_INFO_META_KEY]: this.serverInfo },
                },
            },
        };
    }
}
