import { describe, expect, it } from 'vitest';
import { resolveRequestId } from './request-id.js';

describe('resolveRequestId', () => {
    it('reuses a safe inbound id so a trace survives a hop', () => {
        expect(resolveRequestId({ headerValue: 'abc-123' })).toBe('abc-123');
    });

    it('takes the first value when the header is repeated', () => {
        expect(resolveRequestId({ headerValue: ['first', 'second'] })).toBe('first');
    });

    it('mints an id when the header is absent or empty', () => {
        expect(resolveRequestId({ headerValue: undefined })).toMatch(/^[0-9a-f-]{36}$/);
        expect(resolveRequestId({ headerValue: '' })).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('rejects an id carrying characters that could forge a log line or a header', () => {
        expect(resolveRequestId({ headerValue: 'bad\r\nSet-Cookie: a=b' })).toMatch(/^[0-9a-f-]{36}$/);
        expect(resolveRequestId({ headerValue: '{"msg":"forged"}' })).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('rejects an over-long id', () => {
        expect(resolveRequestId({ headerValue: 'a'.repeat(129) })).toMatch(/^[0-9a-f-]{36}$/);
    });
});
