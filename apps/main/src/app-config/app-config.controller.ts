import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { AppConfigDto } from '@ctm/api-client';

@ApiTags('Config')
@Controller('config')
export class AppConfigController {
    constructor(private readonly config: ConfigService) {}

    /** Public client configuration — values the SPA needs but must not hardcode. */
    @Get()
    @ApiOperation({ summary: 'Public client configuration' })
    @ApiResponse({ status: 200, description: 'Client configuration' })
    get(): AppConfigDto {
        return {
            mcpUrl: this.config.getOrThrow<string>('MCP_PUBLIC_URL').replace(/\/$/, ''),
        };
    }
}
