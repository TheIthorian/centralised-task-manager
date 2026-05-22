import pino from 'pino';

export type Logger = pino.Logger;

/** Creates a named Pino logger for the given context. */
export function createLogger(context: string): pino.Logger {
    const isLocal = process.env['NODE_ENV'] !== 'production';
    const logLevel = process.env['LOG_LEVEL'] || (isLocal ? 'debug' : 'info');

    return pino({
        name: context,
        level: logLevel,
        transport: isLocal ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
    });
}
