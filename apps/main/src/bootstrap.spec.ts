import { describe, it, expect } from 'vitest';
import { buildCorsOptions } from './bootstrap.js';

describe('buildCorsOptions', () => {
    it('allows PATCH requests in CORS preflight responses', () => {
        const corsOptions = buildCorsOptions({});

        expect(corsOptions.methods).toContain('PATCH');
    });

    it('enables credentials for explicit origins', () => {
        const corsOptions = buildCorsOptions({ CORS_ORIGIN: 'http://localhost:5173' });

        expect(corsOptions.origin).toEqual(['http://localhost:5173']);
        expect(corsOptions.credentials).toBe(true);
    });

    it('uses wildcard origin without credentials when CORS_ORIGIN is unset', () => {
        const corsOptions = buildCorsOptions({});

        expect(corsOptions.origin).toBe(true);
        expect(corsOptions.credentials).toBe(false);
    });
});
