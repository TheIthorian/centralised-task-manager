import { z } from 'zod';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

/** Body accepted by `POST /oauth/token`. Field requirements per grant are enforced in the handler. */
export const tokenBodySchema = z.object({
    grant_type: z.enum(['authorization_code', 'refresh_token']),
    code: z.string().max(512).optional(),
    redirect_uri: z.string().max(2048).optional(),
    // RFC 7636 §4.1 bounds the verifier at 43 to 128 characters.
    code_verifier: z.string().min(43).max(128).optional(),
    refresh_token: z.string().max(4096).optional(),
});

export class TokenBodyDto extends createZodDto({ schema: tokenBodySchema, name: 'TokenBodyDto' }) {}

/** Body accepted by `POST /oauth/authorize` when the user submits the consent form. */
// Defaulted so a consent submission with no body parses instead of failing as a missing object.
export const consentBodySchema = z
    .object({
        selected_scopes: z.string().max(1024).optional().describe('Space-delimited subset of the requested scopes.'),
    })
    .default({});

export class ConsentBodyDto extends createZodDto({ schema: consentBodySchema, name: 'ConsentBodyDto' }) {}
