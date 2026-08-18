import { z } from 'zod';
import { registerClientSchema, SUPPORTED_GRANT_TYPES, SUPPORTED_RESPONSE_TYPES } from './dto/register-client.dto.js';
import { clientIdSchema } from './client-id.js';

/** Longest a protocol identifier a client declares can be; grant type URNs are the long ones. */
const MAX_TYPE_LENGTH = 128;

const MAX_DECLARED_TYPES = 16;

/**
 * Grant and response types as a metadata document declares them.
 *
 * Unlike a registration request, these are not narrowed to what this server implements. The
 * document is published once for every authorization server the client talks to, so it names
 * grants this one has never heard of; refusing it over one of those would refuse the client.
 * `supportedGrantTypes` and `supportedResponseTypes` reduce them to what is usable here.
 */
const declaredTypesSchema = z.array(z.string().min(1).max(MAX_TYPE_LENGTH)).max(MAX_DECLARED_TYPES);

/**
 * A Client ID Metadata Document, as published at a client's `client_id` URL
 * (draft-ietf-oauth-client-id-metadata-document-00).
 *
 * The metadata a client publishes about itself is what it would otherwise have sent to the
 * registration endpoint, plus the `client_id` that has to match the URL it was fetched from.
 * Unknown members are stripped.
 */
export const clientIdMetadataSchema = registerClientSchema.extend({
    client_id: clientIdSchema,
    grant_types: declaredTypesSchema.optional(),
    response_types: declaredTypesSchema.optional(),
});

export type ClientIdMetadata = z.infer<typeof clientIdMetadataSchema>;

/** The declared grant types this server implements. Empty when none of them are usable here. */
export function supportedGrantTypes(declared: string[] | undefined): string[] {
    if (!declared) return ['authorization_code'];

    return declared.filter((type) => (SUPPORTED_GRANT_TYPES as readonly string[]).includes(type));
}

/** The declared response types this server implements. Empty when none of them are usable here. */
export function supportedResponseTypes(declared: string[] | undefined): string[] {
    if (!declared) return ['code'];

    return declared.filter((type) => (SUPPORTED_RESPONSE_TYPES as readonly string[]).includes(type));
}
