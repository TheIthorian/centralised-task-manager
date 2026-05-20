import { Module } from '@nestjs/common';
import { OAuthKeyService } from './oauth-key.service.js';
import { WellKnownController } from './well-known.controller.js';

@Module({
    controllers: [WellKnownController],
    providers: [OAuthKeyService],
    exports: [OAuthKeyService],
})
export class OAuthModule {}
