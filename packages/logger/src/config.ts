import { ConfigurationError } from '@ctm/errors';

/** Pino levels this monorepo allows. Ordered quietest-last so the table reads like pino's own. */
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Logging settings read from the environment. */
export type LoggerConfig = {
    level: LogLevel;
    pretty: boolean;
    redact: boolean;
};

/**
 * Defaults for the two switches, matching the Joi schemas in `apps/main` and `apps/mcp`. Both are
 * the safe end of their switch: plain JSON that any collector can parse, and redaction left on.
 */
export const LOGGER_CONFIG_DEFAULTS = { pretty: false, redact: true } as const;

/**
 * Reads and validates the logging variables.
 *
 * `LOG_LEVEL` is required: a level that silently falls back drops lines nobody chose to lose.
 * `LOG_PRETTY` and `LOG_REDACT` fall back to {@link LOGGER_CONFIG_DEFAULTS} when absent, but a
 * value that is present and unparseable is still rejected rather than treated as absent.
 *
 * These defaults have to match the apps' Joi schemas. This runs first — bootstrap builds a logger
 * before Nest validates anything — so if it were stricter than Joi, the Joi default could never be
 * reached and the app would die before the schema was consulted.
 *
 * @throws ConfigurationError when a variable is unparseable, when LOG_LEVEL is absent, or when the
 * result contradicts NODE_ENV.
 */
export function readLoggerConfig(env: NodeJS.ProcessEnv = process.env): LoggerConfig {
    const level = readLevel(env['LOG_LEVEL']);
    const pretty = readBoolean({
        name: 'LOG_PRETTY',
        value: env['LOG_PRETTY'],
        fallback: LOGGER_CONFIG_DEFAULTS.pretty,
    });
    const redact = readBoolean({
        name: 'LOG_REDACT',
        value: env['LOG_REDACT'],
        fallback: LOGGER_CONFIG_DEFAULTS.redact,
    });

    assertSafeInProduction({ nodeEnv: env['NODE_ENV'], pretty, redact });

    return { level, pretty, redact };
}

/**
 * Rejects the combinations that are safe to express but never safe to run.
 *
 * @throws ConfigurationError when production is asked for pretty output or unredacted logs.
 */
export function assertSafeInProduction({
    nodeEnv,
    pretty,
    redact,
}: {
    nodeEnv: string | undefined;
    pretty: boolean;
    redact: boolean;
}): void {
    if (nodeEnv !== 'production') return;

    if (pretty) {
        throw new ConfigurationError(
            'LOG_PRETTY must be false when NODE_ENV=production. pino-pretty is a devDependency and is ' +
                'absent from production images, so the process would crash on the first log line; ' +
                'production log collectors also expect one JSON object per line.',
        );
    }

    if (!redact) {
        throw new ConfigurationError(
            'LOG_REDACT must be true when NODE_ENV=production. Turning it off writes access tokens, ' +
                'passwords, cookies and OAuth codes to stdout in plain text, where the log collector ' +
                'retains them beyond the life of the credential.',
        );
    }
}

function readLevel(value: string | undefined): LogLevel {
    if (value === undefined || value === '') {
        throw new ConfigurationError(`LOG_LEVEL is required. Set one of: ${LOG_LEVELS.join(', ')}.`);
    }

    if (!isLogLevel(value)) {
        throw new ConfigurationError(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}. Received '${value}'.`);
    }

    return value;
}

function isLogLevel(value: string): value is LogLevel {
    return (LOG_LEVELS as readonly string[]).includes(value);
}

// An absent switch takes its default, but a present one is read strictly: '1', 'yes' and 'TRUE'
// each look deliberate enough to be mistaken for working, and a redaction flag silently read as
// false is a leak. An empty string counts as absent, since that is what an unset Railway variable
// and a bare `LOG_PRETTY=` line in a .env file both produce.
function readBoolean({
    name,
    value,
    fallback,
}: {
    name: string;
    value: string | undefined;
    fallback: boolean;
}): boolean {
    if (value === undefined || value === '') return fallback;

    if (value !== 'true' && value !== 'false') {
        throw new ConfigurationError(`${name} must be 'true' or 'false'. Received '${value}'.`);
    }

    return value === 'true';
}
