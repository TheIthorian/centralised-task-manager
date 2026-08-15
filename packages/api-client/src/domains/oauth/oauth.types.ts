/**
 * OpenID Connect Discovery 1.0 provider metadata, served from
 * `GET /.well-known/openid-configuration`.
 */
export type OpenIdConfigurationDto = {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    jwks_uri: string;
    registration_endpoint: string;
    scopes_supported: string[];
    response_types_supported: string[];
    response_modes_supported: string[];
    grant_types_supported: string[];
    subject_types_supported: string[];
    id_token_signing_alg_values_supported: string[];
    token_endpoint_auth_methods_supported: string[];
    code_challenge_methods_supported: string[];
    claims_supported: string[];
};

/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata, served from
 * `GET /.well-known/oauth-authorization-server`.
 */
export type AuthorizationServerMetadataDto = {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint: string;
    jwks_uri: string;
    scopes_supported: string[];
    response_types_supported: string[];
    grant_types_supported: string[];
    token_endpoint_auth_methods_supported: string[];
    code_challenge_methods_supported: string[];
};

/**
 * A single RFC 7517 JSON Web Key. Only the RSA parameters this server publishes are named; a
 * consumer reads the key through a JOSE library rather than these fields directly.
 */
export type JsonWebKeyDto = {
    kty: string;
    n: string;
    e: string;
    use: string;
    alg: string;
    kid: string;
};

/** The key set used to verify tokens this server signed, served from `GET /.well-known/jwks.json`. */
export type JwksDto = {
    keys: JsonWebKeyDto[];
};
