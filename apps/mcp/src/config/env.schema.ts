import Joi from 'joi';
import { LOG_LEVELS, LOGGER_CONFIG_DEFAULTS } from '@ctm/logger';

export const envSchema = Joi.object({
    CTM_API_BASE_URL: Joi.string().uri().required(),
    CTM_PUBLIC_URL: Joi.string().uri().required(),
    MCP_PUBLIC_URL: Joi.string().uri().required(),
    RSA_PUBLIC_KEY: Joi.string().required(),
    PORT: Joi.number().required(),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    // readLoggerConfig in @ctm/logger enforces the same rules and runs first, because bootstrap
    // builds a logger before Nest validates anything. The two must agree: a rule that is stricter
    // here than there is unreachable, and one that is stricter there than here kills the process
    // before this schema is ever consulted. The defaults are imported rather than repeated for
    // exactly that reason. These rules are restated here so a bad value is reported alongside
    // every other variable rather than as a lone stack trace.
    LOG_LEVEL: Joi.string()
        .valid(...LOG_LEVELS)
        .required(),
    LOG_PRETTY: Joi.boolean()
        .optional()
        .default(LOGGER_CONFIG_DEFAULTS.pretty)
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
        .default(LOGGER_CONFIG_DEFAULTS.redact)
        .when('NODE_ENV', {
            is: 'production',
            // oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional key, not a promise.
            then: Joi.valid(true).messages({
                'any.only':
                    'LOG_REDACT must be true when NODE_ENV=production: turning it off writes tokens, passwords, cookies and OAuth codes to stdout in plain text.',
            }),
        }),
});
