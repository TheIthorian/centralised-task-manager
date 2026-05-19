import pino from 'pino';

export type Logger = pino.Logger;

/** Creates a named Pino logger for the given context. */
export function createLogger(context: string): pino.Logger {
    return pino({ name: context });
}
