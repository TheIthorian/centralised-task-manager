import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OAuthClientService } from './oauth-client.service.js';
import { RegisterClientDto } from './dto/register-client.dto.js';
import { RegisterClientResponseDto } from './dto/auth-response.dto.js';
import { StrictRateLimit } from '../rate-limit/rate-limit.decorators.js';

@Controller('.well-known')
export class WellKnownController {
    constructor(private readonly oauthClient: OAuthClientService) {}

    /**
     * RFC 7591 dynamic client registration endpoint.
     *
     * Public and unauthenticated by design, so it carries the strict rate limit: each call
     * costs a bcrypt hash and an unbounded insert.
     */
    @ApiOperation({ summary: 'Register an OAuth 2.0 client' })
    @ApiResponse({
        status: 201,
        description: 'Client registered with client_id and client_secret',
        type: RegisterClientResponseDto,
    })
    @Post('oauth-client')
    @HttpCode(201)
    @StrictRateLimit()
    async registerClient(@Body() dto: RegisterClientDto): Promise<RegisterClientResponseDto> {
        return this.oauthClient.register(dto);
    }
}
