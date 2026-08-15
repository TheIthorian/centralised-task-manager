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
