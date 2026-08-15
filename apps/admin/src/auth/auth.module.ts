import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { LoginAttempt, LoginAttemptSchema } from '@ctm/db';
import { AuditModule } from '../audit/audit.module.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminLoginAttemptsService } from './admin-login-attempts.service.js';

@Module({
    imports: [
        AuditModule,
        MongooseModule.forFeature([{ name: LoginAttempt.name, schema: LoginAttemptSchema }]),
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService): { secret: string; signOptions: { algorithm: 'HS256' } } => ({
                secret: config.getOrThrow<string>('ADMIN_JWT_SECRET'),
                signOptions: { algorithm: 'HS256' },
            }),
        }),
    ],
    controllers: [AdminAuthController],
    providers: [AdminAuthService, AdminLoginAttemptsService],
    exports: [AdminAuthService],
})
export class AuthModule {}
