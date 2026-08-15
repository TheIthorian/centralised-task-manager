import { Controller, Get } from '@nestjs/common';
import type { GrowthMetricsDto, SiteMetricsDto } from '@ctm/api-client';
import { UnvalidatedInput, ValidatedQuery } from '@ctm/nest-common';
import { MetricsService } from './metrics.service.js';
import { GrowthMetricsQueryDto } from './dto/growth-metrics-query.dto.js';

@Controller('metrics')
export class MetricsController {
    constructor(private readonly metrics: MetricsService) {}

    /** Aggregate counts across the deployment, computed per request rather than cached. */
    @Get()
    @UnvalidatedInput('Takes no arguments.')
    siteMetrics(): Promise<SiteMetricsDto> {
        return this.metrics.siteMetrics();
    }

    /** New users and tasks per calendar day over the requested window. */
    @Get('growth')
    growth(@ValidatedQuery(GrowthMetricsQueryDto) query: GrowthMetricsQueryDto): Promise<GrowthMetricsDto> {
        return this.metrics.growthMetrics(query);
    }
}
