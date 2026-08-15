import { Controller, Get, Req } from '@nestjs/common';
import { UnvalidatedInput } from '@ctm/nest-common';
import type { AdminRequest } from './admin.guard.js';
import { AdminIdentityDto } from './dto/admin-identity-response.dto.js';

@Controller('auth')
export class AdminIdentityController {
    /** Who Cloudflare Access says this request is. The SPA reads it to render the operator. */
    @Get('me')
    @UnvalidatedInput('Reads only the identity the guard attached; no client input reaches it.')
    me(@Req() request: AdminRequest): AdminIdentityDto {
        return { email: request.operator.email, subject: request.operator.subject };
    }
}
