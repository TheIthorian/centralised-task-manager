import pino from 'pino';

export type Logger = pino.Logger;

/** Creates a named Pino logger for the given context. */
export function createLogger(context: string): pino.Logger {
    const isLocal = process.env['NODE_ENV'] !== 'production';

    return pino({
        name: context,
        transport: isLocal
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
    });
}
