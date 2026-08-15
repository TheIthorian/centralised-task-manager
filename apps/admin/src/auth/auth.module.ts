import { Module } from '@nestjs/common';
import { AccessVerifierService } from './access-verifier.service.js';
import { AdminIdentityController } from './admin-identity.controller.js';

@Module({
    controllers: [AdminIdentityController],
    providers: [AccessVerifierService],
    exports: [AccessVerifierService],
})
export class AuthModule {}
