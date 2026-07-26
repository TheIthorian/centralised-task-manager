import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { HealthDto } from './dto/health.dto.js';

/** Mongoose `readyState` value for an established connection. */
const CONNECTED = 1;

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(@InjectConnection() private readonly connection: Connection) {}

    /**
     * Liveness probe used by the platform healthcheck.
     *
     * @throws ServiceUnavailableException when MongoDB is not connected.
     */
    @Get()
    @ApiOperation({ summary: 'Service health' })
    @ApiResponse({ status: 200, description: 'Service is healthy', type: HealthDto })
    @ApiResponse({ status: 503, description: 'Database is unreachable' })
    check(): HealthDto {
        const database = this.connection.readyState === CONNECTED ? 'up' : 'down';
        const uptimeSeconds = Math.floor(process.uptime());

        if (database === 'down') {
            throw new ServiceUnavailableException({ status: 'degraded', database, uptimeSeconds } satisfies HealthDto);
        }

        return { status: 'ok', database, uptimeSeconds };
    }
}
