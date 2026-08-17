import { Controller, Post, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { McpService } from './mcp.service.js';
import { negotiateProtocolVersion } from './protocol/negotiation.js';
import { unsupportedProtocolVersionError } from './protocol/json-rpc.js';
import { isPerRequestMetadataVersion, SUPPORTED_PROTOCOL_VERSIONS } from './protocol/versions.js';
import type { JwtPayload } from '../auth/jwt.strategy.js';

type AuthenticatedRequest = FastifyRequest & { user: JwtPayload };

@Controller('mcp')
export class McpController {
    constructor(private readonly mcpService: McpService) {}

    /** MCP Streamable HTTP — client-to-server messages. */
    @Post()
    @UseGuards(JwtAuthGuard)
    async post(@Req() req: AuthenticatedRequest, @Res() reply: FastifyReply): Promise<void> {
        const negotiated = negotiateProtocolVersion(req.headers);

        if (!negotiated.ok) {
            await reply.status(400).send(
                unsupportedProtocolVersionError({
                    id: null,
                    requested: negotiated.requested,
                    supported: SUPPORTED_PROTOCOL_VERSIONS,
                }),
            );

            return;
        }

        if (isPerRequestMetadataVersion(negotiated.version)) {
            const registry = this.mcpService.createToolRegistry(bearerToken(req));
            const dispatcher = this.mcpService.createDispatcher(registry);
            const { status, body } = await dispatcher.dispatch({ headers: req.headers, body: req.body });

            await (body === undefined ? reply.status(status).send() : reply.status(status).send(body));

            return;
        }

        await this.handleWithSdk(req, reply, req.body);
    }

    /**
     * MCP Streamable HTTP — server-to-client SSE stream, for the revisions that had one. The
     * standalone GET stream was removed in 2026-07-28.
     */
    @Get()
    @UseGuards(JwtAuthGuard)
    async get(@Req() req: AuthenticatedRequest, @Res() reply: FastifyReply): Promise<void> {
        const negotiated = negotiateProtocolVersion(req.headers);

        if (!negotiated.ok || isPerRequestMetadataVersion(negotiated.version)) {
            await reply.status(405).send();

            return;
        }

        await this.handleWithSdk(req, reply, undefined);
    }

    private async handleWithSdk(req: AuthenticatedRequest, reply: FastifyReply, body: unknown): Promise<void> {
        // reply.raw bypasses Fastify's onSend hooks, so cors plugin headers never reach the wire.
        // Set them explicitly before the transport writes to reply.raw.
        const origin = req.headers.origin as string | undefined;

        if (origin) {
            reply.raw.setHeader('Access-Control-Allow-Origin', origin);
            reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
            reply.raw.setHeader('Vary', 'Origin');
        }

        const registry = this.mcpService.createToolRegistry(bearerToken(req));
        const server = this.mcpService.createServer(registry);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

        try {
            await server.connect(transport);
            await transport.handleRequest(req.raw, reply.raw, body);
        } finally {
            await server.close();
        }
    }
}

function bearerToken(req: AuthenticatedRequest): string {
    return req.headers['authorization']?.slice(7) ?? '';
}
