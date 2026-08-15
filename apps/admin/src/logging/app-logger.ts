import { createLogger, type Logger } from '@ctm/logger';
import { loadEnv, toLoggerConfig } from '../config/load-env.js';

let root: Logger | undefined;

/**
 * The root logger for this service, built from the validated environment.
 *
 * Memoised because pino sets up a transport worker per instance, and because every child should
 * share one destination.
 */
export function rootLogger(): Logger {
    root ??= createLogger({ context: 'admin', config: toLoggerConfig(loadEnv()) });

    return root;
}

/** A child logger for one class or subsystem. */
export function appLogger(context: string): Logger {
    return rootLogger().child({ name: context });
}

/** Resets the memoised root. Tests only. */
export function resetRootLogger(): void {
    root = undefined;
}
