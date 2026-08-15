import { z } from 'zod';
import { createZodDto, requestObject } from '@ctm/nest-common';

export const growthMetricsQuerySchema = requestObject({
    // Bounded at a year: the aggregation scans every row in the window, and a chart of more days
    // than a dashboard can plot is work nobody sees.
    days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

export class GrowthMetricsQueryDto extends createZodDto<z.infer<typeof growthMetricsQuerySchema>>({
    schema: growthMetricsQuerySchema,
    name: 'GrowthMetricsQueryDto',
}) {}
