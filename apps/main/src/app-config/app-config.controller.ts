import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppConfigDto } from './dto/app-config.dto.js';

@ApiTags('Config')
@Controller('config')
export class AppConfigController {
    constructor(private readonly config: ConfigService) {}

    /** Public client configuration — values the SPA needs but must not hardcode. */
    @Get()
    @ApiOperation({ summary: 'Public client configuration' })
    @ApiResponse({ status: 200, description: 'Client configuration', type: AppConfigDto })
    get(): AppConfigDto {
        // MCP_PUBLIC_URL is the server's base; clients must be given the Streamable
        // HTTP endpoint itself, which apps/mcp serves at /mcp.
        return {
            mcpUrl: `${this.config.getOrThrow<string>('MCP_PUBLIC_URL').replace(/\/$/, '')}/mcp`,
        };
    }
}
