import { z } from 'zod';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import type { RegisterClientInput } from '../oauth-client.service.js';

const ALLOWED_REDIRECT_SCHEMES = new Set(['http:', 'https:']);

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', '::1', 'localhost']);

export const MAX_REDIRECT_URIS = 8;
export const MAX_REDIRECT_URI_LENGTH = 2048;

export const MAX_CONTACTS = 5;
export const MAX_CONTACT_LENGTH = 254;

const DISPLAY_URI_MESSAGE = 'must be an absolute https URI with no fragment';

const SUPPORTED_GRANT_TYPES = ['authorization_code', 'refresh_token'] as const;
const SUPPORTED_RESPONSE_TYPES = ['code'] as const;

/**
 * Display metadata a client declares about itself. Unlike `redirect_uris` there is no loopback
 * exception: these URIs are shown to a user on the Authorized Apps page, where a cleartext or
 * localhost link is either a downgrade they cannot see or meaningless to them.
 */
const displayUriSchema = z.string().min(1).max(MAX_REDIRECT_URI_LENGTH).refine(isDisplayUri, {
    message: DISPLAY_URI_MESSAGE,
});

/**
 * RFC 7591 dynamic client registration request.
 *
 * Metadata this server has no use for is stripped rather than rejected: RFC 7591 §3.1 requires
 * the server to ignore unknown fields, and real MCP clients send plenty of them.
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
    logo_uri: displayUriSchema.optional(),
    client_uri: displayUriSchema.optional(),
    tos_uri: displayUriSchema.optional(),
    policy_uri: displayUriSchema.optional(),
    contacts: z.array(z.email().max(MAX_CONTACT_LENGTH)).max(MAX_CONTACTS).optional(),
    software_id: z
        .string()
        .min(1)
        .max(100)
        // Rendered on the Authorized Apps page, so the same printable-only rule as client_name.
        .regex(/^[^\p{C}]+$/u, { message: 'software_id must not contain control characters' })
        .optional(),
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

/** Validates a client metadata URI that will be shown to a user (`logo_uri`, `client_uri`, …). */
export function isDisplayUri(value: string): boolean {
    let url: URL;

    try {
        url = new URL(value);
    } catch {
        return false;
    }

    if (url.protocol !== 'https:') return false;

    if (url.hash.length > 0) return false;

    return true;
}
