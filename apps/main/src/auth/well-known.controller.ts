import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OAuthClientService, type RegisterClientInput, type RegisterClientOutput } from './oauth-client.service.js';

@Controller('.well-known')
export class WellKnownController {
    constructor(private readonly oauthClient: OAuthClientService) {}

    /** RFC 7591 dynamic client registration endpoint. */
    @ApiOperation({ summary: 'Register an OAuth 2.0 client' })
    @ApiResponse({ status: 201, description: 'Client registered with client_id and client_secret' })
    @Post('oauth-client')
    @HttpCode(201)
    async registerClient(@Body() dto: RegisterClientInput): Promise<RegisterClientOutput> {
        return this.oauthClient.register(dto);
    }
}
