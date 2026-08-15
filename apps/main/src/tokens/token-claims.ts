/** Decoded payload stored inside a signed JWT. */
export type JwtPayload = {
    sub: string;
    email: string;
};

/**
 * Every claim this server signs into an access token.
 *
 * `client_id` rides along so rate limiting can fence one client's traffic off from the same
 * user's other clients (RFC 9068 §2.2).
 */
export type AccessTokenClaims = JwtPayload & {
    iss: string;
    aud: string;
    client_id: string;
};

/** The claims of an OIDC id token: the subject, without the client the token was issued to. */
export type IdTokenClaims = JwtPayload & {
    iss: string;
    aud: string;
};
