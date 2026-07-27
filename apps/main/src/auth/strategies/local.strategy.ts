import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/users.service.js';
import type { UserDocument } from '../../users/schemas/user.schema.js';
import { LoginAttemptsService } from '../login-attempts.service.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly users: UsersService,
        private readonly loginAttempts: LoginAttemptsService,
    ) {
        super({ usernameField: 'email' });
    }

    /**
     * Validate email + password. Throws UnauthorizedException on bad credentials, or
     * RateLimitError once the account has been locked out by repeated failures.
     */
    async validate(email: string, password: string): Promise<UserDocument> {
        await this.loginAttempts.assertNotLocked(email);

        const user = await this.users.findByEmail(email);

        // Count failures for unknown accounts too — otherwise the lockout leaks which
        // addresses are registered.
        if (!user) {
            await this.loginAttempts.recordFailure(email);

            throw new UnauthorizedException('Invalid credentials');
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
            await this.loginAttempts.recordFailure(email);

            throw new UnauthorizedException('Invalid credentials');
        }

        await this.loginAttempts.clear(email);

        return user;
    }
}
