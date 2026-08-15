import { ApiProperty } from '@nestjs/swagger';
import type {
    AuthorizationServerMetadataDto as IAuthorizationServerMetadataDto,
    JsonWebKeyDto as IJsonWebKeyDto,
    JwksDto as IJwksDto,
    OpenIdConfigurationDto as IOpenIdConfigurationDto,
} from '@ctm/api-client';
import type { RegisterClientOutput } from '../oauth-client.service.js';

/** Response returned after successful dynamic client registration. */
export class RegisterClientResponseDto implements RegisterClientOutput {
    client_id!: string;

    // A literal type is not something the swagger plugin can widen into an enum on its own.
    @ApiProperty({ enum: ['none'] })
    token_endpoint_auth_method!: 'none';

    client_name!: string;
    redirect_uris!: string[];
    grant_types!: string[];
    response_types!: string[];
    scopes!: string[];
    issued_at!: string;
    logo_uri?: string;
    client_uri?: string;
    tos_uri?: string;
    policy_uri?: string;
    contacts?: string[];
    software_id?: string;
}

/** OpenID Connect Discovery 1.0 provider metadata. */
export class OpenIdConfigurationDto implements IOpenIdConfigurationDto {
    issuer!: string;
    authorization_endpoint!: string;
    token_endpoint!: string;
    userinfo_endpoint!: string;
    jwks_uri!: string;
    registration_endpoint!: string;
    scopes_supported!: string[];
    response_types_supported!: string[];
    response_modes_supported!: string[];
    grant_types_supported!: string[];
    subject_types_supported!: string[];
    id_token_signing_alg_values_supported!: string[];
    token_endpoint_auth_methods_supported!: string[];
    code_challenge_methods_supported!: string[];
    claims_supported!: string[];
}

/** RFC 8414 OAuth 2.0 Authorization Server Metadata. */
export class AuthorizationServerMetadataDto implements IAuthorizationServerMetadataDto {
    issuer!: string;
    authorization_endpoint!: string;
    token_endpoint!: string;
    registration_endpoint!: string;
    jwks_uri!: string;
    scopes_supported!: string[];
    response_types_supported!: string[];
    grant_types_supported!: string[];
    token_endpoint_auth_methods_supported!: string[];
    code_challenge_methods_supported!: string[];
}

/** A single RFC 7517 JSON Web Key. */
export class JsonWebKeyDto implements IJsonWebKeyDto {
    kty!: string;
    n!: string;
    e!: string;
    use!: string;
    alg!: string;
    kid!: string;
}

/** The key set clients use to verify tokens this server signed. */
export class JwksDto implements IJwksDto {
    keys!: JsonWebKeyDto[];
}
