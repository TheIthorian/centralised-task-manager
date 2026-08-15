import type { AuthorizedAppDto as IAuthorizedAppDto, TokenPair } from '@ctm/api-client';
import { UserDto } from '../../users/dto/user.dto.js';

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

    /** Unverified RFC 7591 metadata the client declared about itself. `logo_uri` is not exposed. */
    clientUri?: string;
    tosUri?: string;
    policyUri?: string;
    contacts?: string[];
    softwareId?: string;
}
