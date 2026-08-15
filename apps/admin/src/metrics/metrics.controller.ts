import { Controller, Get } from '@nestjs/common';
import type { SiteMetricsDto } from '@ctm/api-client';
import { UnvalidatedInput } from '@ctm/nest-common';
import { MetricsService } from './metrics.service.js';

@Controller('metrics')
export class MetricsController {
    constructor(private readonly metrics: MetricsService) {}

    /** Aggregate counts across the deployment, computed per request rather than cached. */
    @Get()
    @UnvalidatedInput('Takes no arguments.')
    siteMetrics(): Promise<SiteMetricsDto> {
        return this.metrics.siteMetrics();
    }
}
