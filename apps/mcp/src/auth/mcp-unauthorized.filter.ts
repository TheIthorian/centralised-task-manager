import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus, UnauthorizedException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { appLogger } from '../logging/app-logger.js';
import { OAuthResourceService } from '../oauth/oauth-resource.service.js';

/** Adds RFC 9728 `WWW-Authenticate` on 401 so MCP clients discover the CTM authorization server. */
@Catch(UnauthorizedException)
export class McpUnauthorizedFilter implements ExceptionFilter {
    private readonly logger = appLogger('mcp-unauthorized');

    constructor(private readonly oauthResource: OAuthResourceService) {}

    /** Log the rejection, then answer with the discovery header MCP clients need. */
    catch(exception: UnauthorizedException, host: ArgumentsHost): void {
        const http = host.switchToHttp();
        const reply = http.getResponse<FastifyReply>();

        this.logger.warn({ err: exception, req: http.getRequest<FastifyRequest>() }, 'MCP request unauthorized');

        reply
            .header('WWW-Authenticate', this.oauthResource.getWwwAuthenticateHeader())
            .status(HttpStatus.UNAUTHORIZED)
            .send({ statusCode: HttpStatus.UNAUTHORIZED, message: 'Unauthorized' });
    }
}
