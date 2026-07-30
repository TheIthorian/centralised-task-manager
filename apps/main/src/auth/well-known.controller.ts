import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OAuthClientService } from './oauth-client.service.js';
import { RegisterClientDto } from './dto/register-client.dto.js';
import { RegisterClientResponseDto } from './dto/auth-response.dto.js';
import { StrictRateLimit } from '../rate-limit/rate-limit.decorators.js';
import { ValidatedBody } from '../common/validation/validated.decorators.js';

@Controller('.well-known')
export class WellKnownController {
    constructor(private readonly oauthClient: OAuthClientService) {}

    /**
     * RFC 7591 dynamic client registration endpoint.
     *
     * Public and unauthenticated by design, so it carries the strict rate limit: each call is an
     * unbounded insert. Registered clients are public and hold no credential; the authorization
     * code exchange is protected by PKCE.
     */
    @ApiOperation({ summary: 'Register an OAuth 2.0 client' })
    @ApiResponse({
        status: 201,
        description: 'Client registered as a public client (token_endpoint_auth_method: none)',
        type: RegisterClientResponseDto,
    })
    @Post('oauth-client')
    @HttpCode(201)
    @StrictRateLimit()
    async registerClient(@ValidatedBody(RegisterClientDto) dto: RegisterClientDto): Promise<RegisterClientResponseDto> {
        return this.oauthClient.register(dto);
    }
}
