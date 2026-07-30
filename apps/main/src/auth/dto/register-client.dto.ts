import { z } from 'zod';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import type { RegisterClientInput } from '../oauth-client.service.js';

const ALLOWED_REDIRECT_SCHEMES = new Set(['http:', 'https:']);

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', '::1', 'localhost']);

export const MAX_REDIRECT_URIS = 8;
export const MAX_REDIRECT_URI_LENGTH = 2048;

const SUPPORTED_GRANT_TYPES = ['authorization_code', 'refresh_token'] as const;
const SUPPORTED_RESPONSE_TYPES = ['code'] as const;

/**
 * RFC 7591 dynamic client registration request.
 *
 * Unrecognised metadata (`logo_uri`, `contacts`, …) is stripped rather than rejected: RFC 7591
 * §3.1 requires the server to ignore unknown fields, and real MCP clients send plenty of them.
 */
export const registerClientSchema = z.object({
    // Required, though RFC 7591 §2 marks it optional: it is the only thing identifying the
    // client on the consent screen, and an unnamed app is one a user cannot make a decision about.
    client_name: z
        .string()
        .min(1)
        .max(100)
        // Printable characters only, since the value is rendered on the consent screen.
        .regex(/^[^\p{C}]+$/u, { message: 'client_name must not contain control characters' }),
    redirect_uris: z
        .array(
            z.string().min(1).max(MAX_REDIRECT_URI_LENGTH).refine(isRegisterableRedirectUri, {
                message: 'must be an http or https URI with no fragment, and must not use http on a non-loopback host',
            }),
        )
        .min(1)
        .max(MAX_REDIRECT_URIS)
        .describe('Absolute URIs with no fragment. Plain http is accepted only for loopback hosts.'),
    grant_types: z.array(z.enum(SUPPORTED_GRANT_TYPES)).max(SUPPORTED_GRANT_TYPES.length).optional(),
    response_types: z.array(z.enum(SUPPORTED_RESPONSE_TYPES)).max(SUPPORTED_RESPONSE_TYPES.length).optional(),
    scopes: z.array(z.string().min(1).max(100)).max(32).optional(),
});

export class RegisterClientDto extends createZodDto<RegisterClientInput>({
    schema: registerClientSchema,
    name: 'RegisterClientDto',
}) {}

/**
 * Validates a single registered redirect URI.
 * Plain `http:` is allowed only for loopback hosts, so a dynamically registered client
 * cannot point users at a cleartext third-party host (RFC 8252 §7.3).
 */
export function isRegisterableRedirectUri(value: string): boolean {
    let url: URL;

    try {
        url = new URL(value);
    } catch {
        return false;
    }

    if (!ALLOWED_REDIRECT_SCHEMES.has(url.protocol)) return false;

    // RFC 6749 §3.1.2: the redirection endpoint must not include a fragment.
    if (url.hash.length > 0) return false;

    if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) return false;

    return true;
}
