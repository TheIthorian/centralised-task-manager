import Joi from 'joi';
import { LOG_LEVELS } from '@ctm/logger';

export const envSchema = Joi.object({
    MONGODB_URI: Joi.string().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    ENCRYPTION_KEY: Joi.string().hex().length(64).required(),
    PORT: Joi.number().required(),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    REDIRECT_BASE_URL: Joi.string().uri().required(),
    WEB_URL: Joi.string().uri().required(),
    MCP_PUBLIC_URL: Joi.string().uri().required(),
    // Domains whose Client ID Metadata Documents this server vouches for on the consent screen.
    // Required but allowed to be empty: trusting nobody is a decision, forgetting to decide is not.
    CIMD_TRUSTED_DOMAINS: Joi.string().allow('').required(),
    RSA_PRIVATE_KEY: Joi.string().required(),
    RSA_PUBLIC_KEY: Joi.string().required(),
    JWT_ACCESS_EXPIRES: Joi.number().integer().min(30).required(),
    REFRESH_TOKEN_EXPIRES_DAYS: Joi.number().integer().min(1).required(),
    // This app owns its logging configuration end to end: @ctm/logger is handed the result and
    // never reads the environment itself, so these are the only defaults and the only guards.
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
                'any.only':
                    'LOG_REDACT must be true when NODE_ENV=production: turning it off writes tokens, passwords, cookies and OAuth codes to stdout in plain text.',
            }),
        }),
    EXPORT_DIR: Joi.string().required(),
    COOKIE_PATH: Joi.string().required(),
    COOKIE_SECURE: Joi.boolean().required(),
    CORS_ORIGIN: Joi.string().optional(),
    // Abuse limits are policy, not per-deployment wiring, so they carry defaults —
    // a deployment that never sets them still gets protected.
    RATE_LIMIT_BURST_PER_MINUTE: Joi.number().integer().min(1).default(100),
    RATE_LIMIT_SUSTAINED_PER_HOUR: Joi.number().integer().min(1).default(2000),
    RATE_LIMIT_STRICT_BURST_PER_MINUTE: Joi.number().integer().min(1).default(10),
    RATE_LIMIT_STRICT_SUSTAINED_PER_HOUR: Joi.number().integer().min(1).default(100),
    RATE_LIMIT_REFRESH_BURST_PER_MINUTE: Joi.number().integer().min(1).default(30),
    RATE_LIMIT_REFRESH_SUSTAINED_PER_HOUR: Joi.number().integer().min(1).default(600),
    RATE_LIMIT_CLIENT_BURST_PER_MINUTE: Joi.number().integer().min(1).default(60),
    RATE_LIMIT_CLIENT_SUSTAINED_PER_HOUR: Joi.number().integer().min(1).default(1000),
    LOGIN_MAX_FAILED_ATTEMPTS: Joi.number().integer().min(1).default(5),
    LOGIN_LOCKOUT_MINUTES: Joi.number().integer().min(1).default(15),
    TODOIST_CLIENT_ID: Joi.string().allow('').optional(),
    TODOIST_CLIENT_SECRET: Joi.string().allow('').optional(),
    GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
    GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
    DISCORD_CLIENT_ID: Joi.string().allow('').optional(),
    DISCORD_CLIENT_SECRET: Joi.string().allow('').optional(),
    DISCORD_BOT_TOKEN: Joi.string().allow('').optional(),
    NOTION_CLIENT_ID: Joi.string().allow('').optional(),
    NOTION_CLIENT_SECRET: Joi.string().allow('').optional(),
});
