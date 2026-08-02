import { ConfigurationError } from '@ctm/errors';
import { LOG_LEVELS, type LoggerConfig, type LogLevel } from '@ctm/logger';
import { envSchema } from './env.schema.js';

// Nest's own defaults when it is handed a validationSchema. Unknown keys have to be allowed
// because process.env carries PATH, HOME and everything else the OS put there.
const VALIDATION_OPTIONS = { allowUnknown: true, abortEarly: false } as const;

let cached: Record<string, unknown> | undefined;

/**
 * Validates `process.env` once and returns the coerced result, with Joi's defaults applied.
 *
 * This is the only place the environment is validated. Bootstrap calls it before Nest exists, so
 * it can build a logger from the result, and `ConfigModule` is handed the same cached object
 * rather than re-validating: two validation points drift, and the earlier one wins silently.
 *
 * @throws ConfigurationError when the environment does not satisfy the schema.
 */
export function loadEnv(): Record<string, unknown> {
    if (cached) return cached;

    const { error, value } = envSchema.validate(process.env, VALIDATION_OPTIONS);

    if (error) throw new ConfigurationError(`Invalid environment: ${error.message}`);

    cached = value as Record<string, unknown>;

    return cached;
}

/**
 * Narrows validated env to what the logger needs, so `@ctm/logger` never sees the environment.
 * Deliberately supplies no defaults of its own: the schema already applied them, and a second set
 * here would be the pair of definitions that let the first pair drift apart.
 *
 * @throws ConfigurationError when called with an environment that has not been through the schema.
 */
export function toLoggerConfig(env: Record<string, unknown>): LoggerConfig {
    const level = env['LOG_LEVEL'];
    const pretty = env['LOG_PRETTY'];
    const redact = env['LOG_REDACT'];

    if (!isLogLevel(level) || typeof pretty !== 'boolean' || typeof redact !== 'boolean') {
        throw new ConfigurationError(
            'Logging config is missing or untyped. toLoggerConfig takes the output of loadEnv, ' +
                'which is where LOG_LEVEL is required and the two switches are defaulted and coerced.',
        );
    }

    return { level, pretty, redact };
}

/** Resets the cache. Tests only: a suite that changes the environment needs to re-read it. */
export function resetEnvCache(): void {
    cached = undefined;
}

function isLogLevel(value: unknown): value is LogLevel {
    return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}
