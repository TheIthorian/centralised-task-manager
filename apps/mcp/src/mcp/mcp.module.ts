import { Module } from '@nestjs/common';
import { McpService } from './mcp.service.js';
import { McpController } from './mcp.controller.js';

@Module({
    controllers: [McpController],
    providers: [McpService],
})
export class McpModule {}
