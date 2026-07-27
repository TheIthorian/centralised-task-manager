import type { AuthorizedAppDto as IAuthorizedAppDto, TokenPair } from '@ctm/api-client';
import { UserDto } from '../../users/dto/user.dto.js';
import type { RegisterClientOutput } from '../oauth-client.service.js';

/** Access/refresh token pair returned after login or refresh. */
export class TokenPairDto implements TokenPair {
    accessToken!: string;

    /** Lifetime of `accessToken` in seconds, so clients can refresh before it expires. */
    expiresIn!: number;

    /** Omitted for web clients — the refresh token is returned as an HttpOnly cookie instead. */
    refreshToken?: string;

    user!: UserDto;
}

/** An OAuth client that a user has authorized. No token data included. */
export class AuthorizedAppDto implements IAuthorizedAppDto {
    clientId!: string;
    clientName!: string;
    scopes!: string[];
    authorizedAt!: string;
    type!: 'oauth';
}

/** Response returned after successful dynamic client registration. */
export class RegisterClientResponseDto implements RegisterClientOutput {
    client_id!: string;
    client_secret!: string;
    client_name!: string;
    redirect_uris!: string[];
    grant_types!: string[];
    response_types!: string[];
    scopes!: string[];
    issued_at!: string;
}
