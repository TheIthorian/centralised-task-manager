import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTokenService } from '../api-token.service.js';
import { UsersService } from '../../users/users.service.js';
import type { JwtPayload } from '../strategies/jwt.strategy.js';

@Injectable()
export class CombinedAuthGuard extends AuthGuard('jwt') {
    constructor(
        private readonly apiTokens: ApiTokenService,
        private readonly users: UsersService,
    ) {
        super();
    }

    /** Allow access via JWT or a ctm_ API token. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: JwtPayload }>();
        const authHeader = request.headers['authorization'] ?? '';

        if (authHeader.startsWith('Bearer ctm_')) {
            const raw = authHeader.slice('Bearer '.length);
            const userId = await this.apiTokens.validate(raw);

            if (!userId) throw new UnauthorizedException('Invalid API token');

            const user = await this.users.findById(userId);

            if (!user) throw new UnauthorizedException('User not found');

            request.user = { sub: userId, email: user.email };

            return true;
        }

        return super.canActivate(context) as Promise<boolean>;
    }
}
