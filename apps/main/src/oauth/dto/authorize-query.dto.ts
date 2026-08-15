import { z } from 'zod';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { codeChallengeMethodSchema } from '../pkce.js';

/**
 * Query parameters accepted by `/oauth/authorize`.
 *
 * Unknown keys are stripped rather than rejected: OAuth and MCP clients send parameters this
 * server does not implement (`nonce`, `prompt`, `resource` from RFC 8707), and rejecting them
 * would fail otherwise valid authorization requests.
 */
export const authorizeQuerySchema = z.object({
    client_id: z.string().min(1).max(128),
    redirect_uri: z
        .string()
        .max(2048)
        .refine((value) => URL.canParse(value), { message: 'must be an absolute URI' }),
    response_type: z.literal('code'),
    scope: z.string().max(1024).optional().describe('Space-delimited scope list.'),
    state: z.string().max(512).optional(),
    // RFC 7636 §4.2: base64url of a SHA-256 digest, so always 43 characters.
    code_challenge: z.string().min(43).max(128),
    // RFC 7636 §4.3 defaults an omitted method to `plain`; this server defaults it to S256
    // instead, because it never accepts a plain challenge and the parameter is optional.
    code_challenge_method: codeChallengeMethodSchema.optional().describe('Only S256 is supported.'),
});

export class AuthorizeQueryDto extends createZodDto({ schema: authorizeQuerySchema, name: 'AuthorizeQueryDto' }) {}
