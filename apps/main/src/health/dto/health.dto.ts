import type { HealthDto as IHealthDto } from '@ctm/api-client';

/** Response from GET /health — service liveness for platform healthchecks. */
export class HealthDto implements IHealthDto {
    status!: 'ok' | 'degraded';

    /** Mongo connection state; omitted by services that have no database. */
    database?: 'up' | 'down';

    uptimeSeconds!: number;
}
