import { z } from 'zod';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { optionalOrNull } from '../../common/zod/param-schemas.js';

export const updateConnectorSchema = z.strictObject({
    enabled: optionalOrNull(z.boolean()),
    // Connector-specific and opaque here: the connector's own JSON Schema is what constrains the
    // keys, applied by POST connection-details rather than at this endpoint.
    settings: optionalOrNull(z.record(z.string(), z.unknown())),
});

export class UpdateConnectorDto extends createZodDto({
    schema: updateConnectorSchema,
    name: 'UpdateConnectorDto',
}) {}
