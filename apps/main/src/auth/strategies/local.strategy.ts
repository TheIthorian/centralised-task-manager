import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/users.service.js';
import type { UserDocument } from '../../users/schemas/user.schema.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly users: UsersService) {
        super({ usernameField: 'email' });
    }

    /** Validate email + password. Throws UnauthorizedException on bad credentials. */
    async validate(email: string, password: string): Promise<UserDocument> {
        const user = await this.users.findByEmail(email);

        if (!user) throw new UnauthorizedException('Invalid credentials');

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) throw new UnauthorizedException('Invalid credentials');

        return user;
    }
}
