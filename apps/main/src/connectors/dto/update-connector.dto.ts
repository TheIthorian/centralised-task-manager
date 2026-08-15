import { z } from 'zod';
import { createZodDto, requestObject } from '@ctm/nest-common';

export const updateConnectorSchema = requestObject({
    enabled: z.boolean().optional(),
    // Connector-specific and opaque here: the connector's own JSON Schema is what constrains the
    // keys, applied by POST connection-details rather than at this endpoint.
    settings: z.record(z.string(), z.unknown()).optional(),
});

export class UpdateConnectorDto extends createZodDto({
    schema: updateConnectorSchema,
    name: 'UpdateConnectorDto',
}) {}
