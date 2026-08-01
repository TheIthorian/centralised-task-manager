import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { bindRequestUser } from '@ctm/logger';

/** Decoded payload stored inside a signed JWT. */
export interface JwtPayload {
    sub: string;
    email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: Buffer.from(config.getOrThrow<string>('RSA_PUBLIC_KEY'), 'base64').toString('utf8'),
            algorithms: ['RS256'],
        });
    }

    /** Return the JWT payload as the request user, and correlate the rest of the request to it. */
    validate(payload: JwtPayload): JwtPayload {
        // The correlation context was opened by the request logging middleware, which runs before
        // any guard, so this attaches the user to a store that already exists.
        bindRequestUser({ userId: payload.sub });

        return payload;
    }
}
