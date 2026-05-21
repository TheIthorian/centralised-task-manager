import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus, UnauthorizedException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { OAuthResourceService } from '../oauth/oauth-resource.service.js';

/** Adds RFC 9728 `WWW-Authenticate` on 401 so MCP clients discover the CTM authorization server. */
@Catch(UnauthorizedException)
export class McpUnauthorizedFilter implements ExceptionFilter {
    constructor(private readonly oauthResource: OAuthResourceService) {}

    catch(_exception: UnauthorizedException, host: ArgumentsHost): void {
        const reply = host.switchToHttp().getResponse<FastifyReply>();

        reply
            .header('WWW-Authenticate', this.oauthResource.getWwwAuthenticateHeader())
            .status(HttpStatus.UNAUTHORIZED)
            .send({ statusCode: HttpStatus.UNAUTHORIZED, message: 'Unauthorized' });
    }
}
