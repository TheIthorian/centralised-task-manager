import Joi from 'joi';
import { LOG_LEVELS } from '@ctm/logger';

export const envSchema = Joi.object({
    MONGODB_URI: Joi.string().required(),
    PORT: Joi.number().required(),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),

    // A single operator, so a single credential. ADMIN_PASSWORD_HASH is a bcrypt hash: the
    // plaintext password must never be an environment variable on a running server.
    ADMIN_USERNAME: Joi.string().min(3).max(200).required(),
    ADMIN_PASSWORD_HASH: Joi.string().pattern(/^\$2[aby]\$\d{2}\$/).required().messages({
        'string.pattern.base': 'ADMIN_PASSWORD_HASH must be a bcrypt hash, not a plaintext password',
    }),
    ADMIN_JWT_SECRET: Joi.string().min(32).required(),
    ADMIN_SESSION_EXPIRES_MINUTES: Joi.number().integer().min(5).max(1440).optional().default(720),
    ADMIN_MAX_FAILED_ATTEMPTS: Joi.number().integer().min(1).optional().default(5),
    ADMIN_LOCKOUT_MINUTES: Joi.number().integer().min(1).optional().default(15),

    /** Origin the admin SPA is served from. Required: the session cookie is credentialed. */
    ADMIN_WEB_URL: Joi.string().uri().required(),
    COOKIE_SECURE: Joi.boolean().optional().default(true),

    LOG_LEVEL: Joi.string()
        .valid(...LOG_LEVELS)
        .required(),
    LOG_PRETTY: Joi.boolean()
        .optional()
        .default(false)
        .when('NODE_ENV', {
            is: 'production',
            // oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional key, not a promise.
            then: Joi.valid(false).messages({
                'any.only':
                    'LOG_PRETTY must be false when NODE_ENV=production: pino-pretty is a devDependency and is absent from production images.',
            }),
        }),
    LOG_REDACT: Joi.boolean()
        .optional()
        .default(true)
        .when('NODE_ENV', {
            is: 'production',
            // oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional key, not a promise.
            then: Joi.valid(true).messages({
                'any.only': 'LOG_REDACT must be true when NODE_ENV=production',
            }),
        }),
});
