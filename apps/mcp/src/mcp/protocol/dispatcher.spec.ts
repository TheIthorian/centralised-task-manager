import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { StatelessDispatcher, TOOL_LIST_TTL_MS } from './dispatcher.js';
import { JsonRpcErrorCode } from './json-rpc.js';
import { RequestMetaKey, SERVER_INFO_META_KEY } from './request-metadata.js';
import { ToolRegistry } from './tool-registry.js';
import { McpProtocolVersion } from './versions.js';
import type { Logger } from '@ctm/logger';

const SERVER_INFO = { name: 'ctm-mcp', version: '1.0.0' };

const logger = { error: vi.fn() } as unknown as Logger;

describe('StatelessDispatcher', () => {
    let registry: ToolRegistry;
    let dispatcher: StatelessDispatcher;

    beforeEach(() => {
        registry = new ToolRegistry(logger);

        registry.registerTool(
            'echo',
            { description: 'echoes', inputSchema: { text: z.string() }, annotations: { readOnlyHint: true } },
            async ({ text }) => ({ content: [{ type: 'text', text }] }),
        );

        dispatcher = new StatelessDispatcher(registry, SERVER_INFO);
    });

    it('lists tools with caching hints and the server identity', async () => {
        const { status, body } = await dispatcher.dispatch({
            headers: headersFor({ method: 'tools/list' }),
            body: request({ id: 1, method: 'tools/list' }),
        });

        expect(status).toBe(200);
        expect(body).toMatchObject({
            id: 1,
            result: {
                resultType: 'complete',
                tools: [{ name: 'echo', description: 'echoes', annotations: { readOnlyHint: true } }],
                ttlMs: TOOL_LIST_TTL_MS,
                cacheScope: 'public',
                _meta: { [SERVER_INFO_META_KEY]: SERVER_INFO },
            },
        });
    });

    it('calls a tool named by both the header and the body', async () => {
        const { status, body } = await dispatcher.dispatch({
            headers: headersFor({ method: 'tools/call', name: 'echo' }),
            body: request({ id: 2, method: 'tools/call', params: { name: 'echo', arguments: { text: 'hi' } } }),
        });

        expect(status).toBe(200);
        expect(body).toMatchObject({
            id: 2,
            result: { resultType: 'complete', content: [{ type: 'text', text: 'hi' }] },
        });
    });

    it('rejects a request whose Mcp-Name header disagrees with the body', async () => {
        const { status, body } = await dispatcher.dispatch({
            headers: headersFor({ method: 'tools/call', name: 'other' }),
            body: request({ id: 3, method: 'tools/call', params: { name: 'echo', arguments: { text: 'hi' } } }),
        });

        expect(status).toBe(400);
        expect(body).toMatchObject({ error: { code: JsonRpcErrorCode.HeaderMismatch } });
    });

    it('accepts a Base64-encoded Mcp-Name that decodes to the body value', async () => {
        const name = 'echo';
        const { status } = await dispatcher.dispatch({
            headers: headersFor({
                method: 'tools/call',
                name: `=?base64?${Buffer.from(name).toString('base64')}?=`,
            }),
            body: request({ id: 4, method: 'tools/call', params: { name, arguments: { text: 'hi' } } }),
        });

        expect(status).toBe(200);
    });

    it('rejects a request that omits the required protocol metadata', async () => {
        const { status, body } = await dispatcher.dispatch({
            headers: headersFor({ method: 'tools/list' }),
            body: { jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} },
        });

        expect(status).toBe(400);
        expect(body).toMatchObject({ error: { code: JsonRpcErrorCode.InvalidParams } });
    });

    it('answers an unimplemented method with 404 and a method-not-found error', async () => {
        const { status, body } = await dispatcher.dispatch({
            headers: headersFor({ method: 'resources/list' }),
            body: request({ id: 6, method: 'resources/list' }),
        });

        expect(status).toBe(404);
        expect(body).toMatchObject({ error: { code: JsonRpcErrorCode.MethodNotFound } });
    });

    it('accepts a notification without answering it', async () => {
        const result = await dispatcher.dispatch({
            headers: headersFor({ method: 'notifications/anything' }),
            body: request({ method: 'notifications/anything' }),
        });

        expect(result).toEqual({ status: 202 });
    });

    it('returns an error result when the arguments do not match the tool schema', async () => {
        const { body } = await dispatcher.dispatch({
            headers: headersFor({ method: 'tools/call', name: 'echo' }),
            body: request({ id: 7, method: 'tools/call', params: { name: 'echo', arguments: { text: 42 } } }),
        });

        expect(body).toMatchObject({ result: { isError: true } });
    });
});

function headersFor({ method, name }: { method: string; name?: string }): Record<string, string> {
    return {
        'mcp-protocol-version': McpProtocolVersion.V2026_07_28,
        'mcp-method': method,
        ...(name === undefined ? {} : { 'mcp-name': name }),
    };
}

function request({
    id,
    method,
    params = {},
}: {
    id?: number;
    method: string;
    params?: Record<string, unknown>;
}): Record<string, unknown> {
    return {
        jsonrpc: '2.0',
        ...(id === undefined ? {} : { id }),
        method,
        params: {
            ...params,
            _meta: {
                [RequestMetaKey.ProtocolVersion]: McpProtocolVersion.V2026_07_28,
                [RequestMetaKey.ClientCapabilities]: {},
            },
        },
    };
}
