import { createEnvLoader } from '@ctm/env';
import { InternalError } from '@ctm/errors';
import { envSchema } from './env.schema.js';

/**
 * The OpenAPI generator boots the app module in Nest preview mode, where no provider is
 * instantiated and nothing reads configuration, so the spec can be produced without an
 * environment at all.
 */
const skipEnvValidation = process.env['OPENAPI_GENERATION'] === 'true';

if (skipEnvValidation && process.env['NODE_ENV'] === 'production') {
    throw new InternalError('OPENAPI_GENERATION must never be set on a running server');
}

export const { loadEnv, toLoggerConfig, resetEnvCache } = createEnvLoader({
    schema: envSchema,
    // The generator has no environment to validate, so it is given values of its own rather than
    // falling through to the schema's defaults. These are not production defaults.
    bypass: () =>
        skipEnvValidation ? { ...process.env, LOG_LEVEL: 'error', LOG_PRETTY: false, LOG_REDACT: true } : undefined,
});
