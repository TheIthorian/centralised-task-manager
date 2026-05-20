import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

@Injectable()
export class AuthService {
    constructor(
        private readonly users: UsersService,
        private readonly jwt: JwtService,
    ) {}

    /** Register a new user and return a signed JWT. */
    async register({ email, password }: { email: string; password: string }): Promise<{ accessToken: string }> {
        const user = await this.users.create({ email, password });

        return this.signToken(user);
    }

    /** Sign a JWT for an already-validated user (called after local strategy validates). */
    signToken(user: UserDocument): { accessToken: string } {
        const payload: JwtPayload = { sub: String(user._id), email: user.email };

        return { accessToken: this.jwt.sign(payload) };
    }
}
