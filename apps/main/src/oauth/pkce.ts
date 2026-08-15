import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * PKCE code challenge methods this server accepts (RFC 7636 §4.2).
 *
 * `plain` is deliberately absent: OAuth 2.1 requires S256 for public clients, and every client
 * of this server is public. Discovery metadata, the authorize DTO and the stored auth code all
 * read this constant, so support cannot drift between what is advertised and what is verified.
 */
export const CODE_CHALLENGE_METHODS = ['S256'] as const;

/** A PKCE code challenge method this server accepts. */
export type CodeChallengeMethod = (typeof CODE_CHALLENGE_METHODS)[number];

/** Schema for the `code_challenge_method` authorization request parameter. */
export const codeChallengeMethodSchema = z.enum(CODE_CHALLENGE_METHODS);

/** Narrows a stored or otherwise unchecked method string to a supported one. */
export function isSupportedCodeChallengeMethod(method: string): method is CodeChallengeMethod {
    return (CODE_CHALLENGE_METHODS as readonly string[]).includes(method);
}

/** Checks a PKCE `code_verifier` against the challenge recorded with the authorization code. */
export function verifyCodeChallenge({
    codeVerifier,
    codeChallenge,
    codeChallengeMethod,
}: {
    codeVerifier: string;
    codeChallenge: string;
    codeChallengeMethod: CodeChallengeMethod;
}): boolean {
    return transformVerifier({ codeVerifier, codeChallengeMethod }) === codeChallenge;
}

// Exhaustive over CodeChallengeMethod: adding a method to CODE_CHALLENGE_METHODS fails to compile
// until its transform is written here, rather than silently falling through to the S256 branch.
function transformVerifier({
    codeVerifier,
    codeChallengeMethod,
}: {
    codeVerifier: string;
    codeChallengeMethod: CodeChallengeMethod;
}): string {
    switch (codeChallengeMethod) {
        case 'S256':
            return createHash('sha256').update(codeVerifier).digest('base64url');
    }
}
