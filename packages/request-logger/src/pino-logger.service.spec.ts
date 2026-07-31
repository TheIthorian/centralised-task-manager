import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@ctm/logger';
import { PinoLoggerService } from './pino-logger.service.js';

describe('PinoLoggerService', () => {
    it('maps a single trailing argument to context, not to a stack', () => {
        const { service, calls } = serviceWithFakeLogger();

        service.error('Something failed', 'ExceptionsHandler');

        expect(calls.error[0]).toEqual({ msg: 'Something failed', context: 'ExceptionsHandler' });
    });

    it('maps Nest’s (message, stack, context) form onto both fields', () => {
        const { service, calls } = serviceWithFakeLogger();

        service.error('Something failed', 'Error: boom\n    at x', 'ExceptionsHandler');

        expect(calls.error[0]).toEqual({
            msg: 'Something failed',
            context: 'ExceptionsHandler',
            stack: 'Error: boom\n    at x',
        });
    });

    it('logs an Error argument as err so the serializer produces type and stack', () => {
        const { service, calls } = serviceWithFakeLogger();
        const err = new Error('boom');

        service.error(err, 'ExceptionsHandler');

        expect(calls.error[0]).toEqual({ msg: 'boom', context: 'ExceptionsHandler', err });
    });

    it('routes each Nest level to the matching pino level', () => {
        const { service, calls } = serviceWithFakeLogger();

        service.log('a');
        service.warn('b');
        service.debug('c');
        service.verbose('d');
        service.fatal('e');

        expect(calls.info[0]).toEqual({ msg: 'a' });
        expect(calls.warn[0]).toEqual({ msg: 'b' });
        expect(calls.debug[0]).toEqual({ msg: 'c' });
        expect(calls.trace[0]).toEqual({ msg: 'd' });
        expect(calls.fatal[0]).toEqual({ msg: 'e' });
    });

    it('stringifies a non-string message', () => {
        const { service, calls } = serviceWithFakeLogger();

        service.log({ mapped: '/tasks' });

        expect(calls.info[0]).toEqual({ msg: '{"mapped":"/tasks"}' });
    });
});

type Calls = Record<'info' | 'warn' | 'error' | 'debug' | 'trace' | 'fatal', Record<string, unknown>[]>;

function serviceWithFakeLogger(): { service: PinoLoggerService; calls: Calls } {
    const calls: Calls = { info: [], warn: [], error: [], debug: [], trace: [], fatal: [] };
    const record =
        (level: keyof Calls) =>
        (payload: Record<string, unknown>): void => {
            calls[level].push(payload);
        };

    const service = new PinoLoggerService();

    // The service builds its logger in the constructor, so the fake is swapped in afterwards;
    // what is under test is the argument mapping, not pino itself.
    const fake = {
        info: vi.fn(record('info')),
        warn: vi.fn(record('warn')),
        error: vi.fn(record('error')),
        debug: vi.fn(record('debug')),
        trace: vi.fn(record('trace')),
        fatal: vi.fn(record('fatal')),
    } as unknown as Logger;

    Object.defineProperty(service, 'logger', { value: fake });

    return { service, calls };
}
