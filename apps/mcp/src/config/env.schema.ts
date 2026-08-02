import Joi from 'joi';
import { LOG_LEVELS } from '@ctm/logger';

export const envSchema = Joi.object({
    CTM_API_BASE_URL: Joi.string().uri().required(),
    CTM_PUBLIC_URL: Joi.string().uri().required(),
    MCP_PUBLIC_URL: Joi.string().uri().required(),
    RSA_PUBLIC_KEY: Joi.string().required(),
    PORT: Joi.number().required(),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
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
});
