import { Controller, Post, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { McpService } from './mcp.service.js';
import type { JwtPayload } from '../auth/jwt.strategy.js';

type AuthenticatedRequest = FastifyRequest & { user: JwtPayload };

@Controller('mcp')
export class McpController {
    constructor(private readonly mcpService: McpService) {}

    /** MCP Streamable HTTP — client-to-server messages. */
    @Post()
    @UseGuards(JwtAuthGuard)
    async post(@Req() req: AuthenticatedRequest, @Res() reply: FastifyReply): Promise<void> {
        await this.handle(req, reply, req.body);
    }

    /** MCP Streamable HTTP — server-to-client SSE stream. */
    @Get()
    @UseGuards(JwtAuthGuard)
    async get(@Req() req: AuthenticatedRequest, @Res() reply: FastifyReply): Promise<void> {
        await this.handle(req, reply, undefined);
    }

    private async handle(req: AuthenticatedRequest, reply: FastifyReply, body: unknown): Promise<void> {
        const token = req.headers['authorization']?.slice(7) ?? '';
        const server = this.mcpService.createServer(token);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

        try {
            await server.connect(transport);
            await transport.handleRequest(req.raw, reply.raw, body);
        } finally {
            await server.close();
        }
    }
}
