import { z } from 'zod';
import { KNOWN_SCOPES } from '@ctm/db';
import { createZodDto, requestObject } from '@ctm/nest-common';

const redirectUrisSchema = z.array(z.string().url().max(2000)).min(1).max(20);
const scopesSchema = z.array(z.string().max(100)).min(1).max(KNOWN_SCOPES.length);
const grantTypesSchema = z.array(z.enum(['authorization_code', 'refresh_token'])).min(1).max(4);
const responseTypesSchema = z.array(z.enum(['code'])).min(1).max(2);
const contactsSchema = z.array(z.string().email().max(320)).max(10);

export const listOAuthClientsQuerySchema = requestObject({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    skip: z.coerce.number().int().min(0).max(100_000).optional().default(0),
    isDynamic: z
        .union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')])
        .optional(),
    search: z.string().max(200).optional(),
});

export class ListOAuthClientsQueryDto extends createZodDto<z.infer<typeof listOAuthClientsQuerySchema>>({
    schema: listOAuthClientsQuerySchema,
    name: 'ListOAuthClientsQueryDto',
}) {}

export const createOAuthClientSchema = requestObject({
    clientName: z.string().min(1).max(200),
    redirectUris: redirectUrisSchema,
    scopes: scopesSchema,
    grantTypes: grantTypesSchema.optional(),
    responseTypes: responseTypesSchema.optional(),
    clientUri: z.string().url().max(2000).optional(),
    tosUri: z.string().url().max(2000).optional(),
    policyUri: z.string().url().max(2000).optional(),
    contacts: contactsSchema.optional(),
});

export class CreateOAuthClientDto extends createZodDto<z.infer<typeof createOAuthClientSchema>>({
    schema: createOAuthClientSchema,
    name: 'CreateOAuthClientDto',
}) {}

// Not `requestObject`: the display fields accept an explicit null to clear them, which
// requestObject strips before parsing.
export const updateOAuthClientSchema = z
    .strictObject({
        clientName: z.string().min(1).max(200).optional(),
        redirectUris: redirectUrisSchema.optional(),
        scopes: scopesSchema.optional(),
        grantTypes: grantTypesSchema.optional(),
        responseTypes: responseTypesSchema.optional(),
        clientUri: z.string().url().max(2000).nullable().optional(),
        tosUri: z.string().url().max(2000).nullable().optional(),
        policyUri: z.string().url().max(2000).nullable().optional(),
        contacts: contactsSchema.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: 'must change at least one field' });

export class UpdateOAuthClientDto extends createZodDto<z.infer<typeof updateOAuthClientSchema>>({
    schema: updateOAuthClientSchema,
    name: 'UpdateOAuthClientDto',
}) {}
