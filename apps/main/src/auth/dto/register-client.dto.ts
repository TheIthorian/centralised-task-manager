import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayNotEmpty,
    IsArray,
    IsIn,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    Validate,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
} from 'class-validator';
import type { RegisterClientInput } from '../oauth-client.service.js';

/** Schemes that must never be accepted as a redirect target. */
const DENIED_REDIRECT_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:']);

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', '::1', 'localhost']);

export const MAX_REDIRECT_URIS = 8;
export const MAX_REDIRECT_URI_LENGTH = 2048;

const SUPPORTED_GRANT_TYPES = ['authorization_code', 'refresh_token'];
const SUPPORTED_RESPONSE_TYPES = ['code'];

/**
 * Validates a single registered redirect URI.
 * Plain `http:` is allowed only for loopback hosts, so a dynamically registered client
 * cannot point users at a cleartext third-party host (RFC 8252 §7.3).
 */
export function isRegisterableRedirectUri(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_REDIRECT_URI_LENGTH) return false;

    let url: URL;

    try {
        url = new URL(value);
    } catch {
        return false;
    }

    if (DENIED_REDIRECT_SCHEMES.has(url.protocol)) return false;

    // RFC 6749 §3.1.2: the redirection endpoint must not include a fragment.
    if (url.hash.length > 0) return false;

    if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) return false;

    return true;
}

@ValidatorConstraint({ name: 'registerableRedirectUris', async: false })
export class RegisterableRedirectUrisConstraint implements ValidatorConstraintInterface {
    /** Returns true when every entry is a redirect URI this server will accept. */
    validate(value: unknown): boolean {
        return Array.isArray(value) && value.every(isRegisterableRedirectUri);
    }

    /** Message shown when validation fails. */
    defaultMessage(): string {
        return `each redirect_uris entry must be an absolute URI with no fragment, at most ${MAX_REDIRECT_URI_LENGTH} characters, and must not use http on a non-loopback host`;
    }
}

/**
 * RFC 7591 dynamic client registration request.
 *
 * Unrecognised metadata (`logo_uri`, `contacts`, …) is stripped rather than rejected: RFC 7591
 * §3.1 requires the server to ignore unknown fields, and real MCP clients send plenty of them.
 */
export class RegisterClientDto implements RegisterClientInput {
    // Optional per RFC 7591 §2.
    @ApiPropertyOptional({ maxLength: 100, example: 'My MCP Client' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    // Printable characters only. client_name is rendered on the consent screen, so control
    // characters must not survive into it.
    @Matches(/^[^\p{C}]*$/u, { message: 'client_name must not contain control characters' })
    client_name?: string;

    @ApiProperty({
        maxItems: MAX_REDIRECT_URIS,
        example: ['http://127.0.0.1:8976/callback'],
        description: 'Absolute URIs with no fragment. Plain http is accepted only for loopback hosts.',
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(MAX_REDIRECT_URIS)
    @Validate(RegisterableRedirectUrisConstraint)
    redirect_uris!: string[];

    @ApiPropertyOptional({ enum: SUPPORTED_GRANT_TYPES, isArray: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(SUPPORTED_GRANT_TYPES.length)
    @IsIn(SUPPORTED_GRANT_TYPES, { each: true })
    grant_types?: string[];

    @ApiPropertyOptional({ enum: SUPPORTED_RESPONSE_TYPES, isArray: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(SUPPORTED_RESPONSE_TYPES.length)
    @IsIn(SUPPORTED_RESPONSE_TYPES, { each: true })
    response_types?: string[];

    @ApiPropertyOptional({ example: ['openid', 'tasks:read'] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(32)
    @IsString({ each: true })
    @MaxLength(100, { each: true })
    scopes?: string[];
}
