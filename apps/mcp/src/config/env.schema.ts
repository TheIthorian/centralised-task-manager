import Joi from 'joi';
import { LOG_LEVELS } from '@ctm/logger';

export const envSchema = Joi.object({
    CTM_API_BASE_URL: Joi.string().uri().required(),
    CTM_PUBLIC_URL: Joi.string().uri().required(),
    MCP_PUBLIC_URL: Joi.string().uri().required(),
    RSA_PUBLIC_KEY: Joi.string().required(),
    PORT: Joi.number().required(),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    // The single source of truth for these rules is readLoggerConfig in @ctm/logger, which runs
    // first (bootstrap builds a logger before Nest boots) and is stricter about booleans. They are
    // repeated here so a bad combination is also reported by the env validator, alongside every
    // other variable, rather than as a lone stack trace.
    LOG_LEVEL: Joi.string()
        .valid(...LOG_LEVELS)
        .required(),
    LOG_PRETTY: Joi.boolean()
        .required()
        .when('NODE_ENV', {
            is: 'production',
            // oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional key, not a promise.
            then: Joi.valid(false).messages({
                'any.only':
                    'LOG_PRETTY must be false when NODE_ENV=production: pino-pretty is a devDependency and is absent from production images.',
            }),
        }),
    LOG_REDACT: Joi.boolean()
        .required()
        .when('NODE_ENV', {
            is: 'production',
            // oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional key, not a promise.
            then: Joi.valid(true).messages({
                'any.only':
                    'LOG_REDACT must be true when NODE_ENV=production: turning it off writes tokens, passwords, cookies and OAuth codes to stdout in plain text.',
            }),
        }),
});
