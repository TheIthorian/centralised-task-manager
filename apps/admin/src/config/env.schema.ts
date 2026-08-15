import Joi from 'joi';
import { LOG_LEVELS } from '@ctm/logger';

export const envSchema = Joi.object({
    MONGODB_URI: Joi.string().required(),
    PORT: Joi.number().required(),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),

    // Cloudflare Access authenticates the operator; this app only verifies what Access signed.
    // The team domain is the JWT issuer and the host of the JWKS.
    CF_ACCESS_TEAM_DOMAIN: Joi.string().hostname().required(),
    // The Access application's audience tag. Without it a token minted for any other application
    // in the same team verifies here, because every application shares the team's signing keys.
    CF_ACCESS_AUD: Joi.string().min(16).required(),

    /**
     * Treat every request as this operator, skipping Access entirely. Local development only:
     * there is no Access in front of a laptop.
     */
    ADMIN_DEV_BYPASS_EMAIL: Joi.string()
        .email()
        .optional()
        .when('NODE_ENV', {
            is: 'production',
            // oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional key, not a promise.
            then: Joi.forbidden().messages({
                'any.unknown': 'ADMIN_DEV_BYPASS_EMAIL must never be set when NODE_ENV=production: it disables authentication.',
            }),
        }),

    /** Origin the admin SPA is served from. Required: the Access cookie is credentialed. */
    ADMIN_WEB_URL: Joi.string().uri().required(),

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
