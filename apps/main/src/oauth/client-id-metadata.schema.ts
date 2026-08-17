import { z } from 'zod';
import { registerClientSchema } from './dto/register-client.dto.js';
import { clientIdSchema } from './client-id.js';

/**
 * A Client ID Metadata Document, as published at a client's `client_id` URL
 * (draft-ietf-oauth-client-id-metadata-document-00).
 *
 * The metadata a client publishes about itself is what it would otherwise have sent to the
 * registration endpoint, plus the `client_id` that has to match the URL it was fetched from.
 * Unknown members are stripped: the document is written for every authorization server the client
 * talks to, not for this one.
 */
export const clientIdMetadataSchema = registerClientSchema.extend({
    client_id: clientIdSchema,
});

export type ClientIdMetadata = z.infer<typeof clientIdMetadataSchema>;
