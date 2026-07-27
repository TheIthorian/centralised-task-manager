import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OAuthClientService, type RegisterClientInput } from './oauth-client.service.js';
import { RegisterClientResponseDto } from './dto/auth-response.dto.js';

@Controller('.well-known')
export class WellKnownController {
    constructor(private readonly oauthClient: OAuthClientService) {}

    /** RFC 7591 dynamic client registration endpoint. */
    @ApiOperation({ summary: 'Register an OAuth 2.0 client' })
    @ApiResponse({
        status: 201,
        description: 'Client registered with client_id and client_secret',
        type: RegisterClientResponseDto,
    })
    @Post('oauth-client')
    @HttpCode(201)
    async registerClient(@Body() dto: RegisterClientInput): Promise<RegisterClientResponseDto> {
        return this.oauthClient.register(dto);
    }
}
