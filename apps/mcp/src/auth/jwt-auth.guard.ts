import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Validates RS256 Bearer JWTs issued by the apps/main OAuth AS. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
