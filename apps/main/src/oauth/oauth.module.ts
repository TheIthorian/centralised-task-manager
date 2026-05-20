import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthCode, AuthCodeSchema } from './schemas/auth-code.schema.js';
import { OAuthKeyService } from './oauth-key.service.js';
import { OAuthService } from './oauth.service.js';
import { OAuthController } from './oauth.controller.js';
import { WellKnownController } from './well-known.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
    imports: [MongooseModule.forFeature([{ name: AuthCode.name, schema: AuthCodeSchema }]), AuthModule, UsersModule],
    controllers: [OAuthController, WellKnownController],
    providers: [OAuthKeyService, OAuthService],
    exports: [OAuthKeyService, OAuthService],
})
export class OAuthModule {}
