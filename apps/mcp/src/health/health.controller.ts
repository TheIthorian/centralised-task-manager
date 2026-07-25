import { Controller, Get } from '@nestjs/common';
import type { HealthDto } from '@ctm/api-client';

@Controller('health')
export class HealthController {
    /** Liveness probe used by the platform healthcheck. */
    @Get()
    check(): HealthDto {
        return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
    }
}
