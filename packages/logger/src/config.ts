import { ConfigurationError } from '@ctm/errors';

/** Pino levels this monorepo allows. Ordered quietest-last so the table reads like pino's own. */
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Logging settings, all read from the environment and none of them defaulted. */
export type LoggerConfig = {
    level: LogLevel;
    pretty: boolean;
    redact: boolean;
};

/**
 * Reads and validates the three logging variables. Every one is required: a log level that
 * silently falls back hides lines nobody asked to lose, and a redaction flag that defaults to on
 * is a flag nobody notices is off.
 *
 * @throws ConfigurationError when a variable is absent, unparseable, or contradicts NODE_ENV.
 */
export function readLoggerConfig(env: NodeJS.ProcessEnv = process.env): LoggerConfig {
    const level = readLevel(env['LOG_LEVEL']);
    const pretty = readBoolean({ name: 'LOG_PRETTY', value: env['LOG_PRETTY'] });
    const redact = readBoolean({ name: 'LOG_REDACT', value: env['LOG_REDACT'] });

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

// Only the two literals are accepted. '1', 'yes' and 'TRUE' each look deliberate enough to be
// mistaken for working, and a redaction flag read as false by accident is a silent leak.
function readBoolean({ name, value }: { name: string; value: string | undefined }): boolean {
    if (value === undefined || value === '') {
        throw new ConfigurationError(`${name} is required. Set it to 'true' or 'false'.`);
    }

    if (value !== 'true' && value !== 'false') {
        throw new ConfigurationError(`${name} must be 'true' or 'false'. Received '${value}'.`);
    }

    return value === 'true';
}
