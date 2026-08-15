import { describe, it, expect } from 'vitest';
import { ConfigurationError } from '@ctm/errors';
import { normalizeBaseUrl } from './base-url.js';

describe('normalizeBaseUrl', () => {
    it('keeps an ordinary URL', () => {
        expect(normalizeBaseUrl('https://api.example.com')).toBe('https://api.example.com');
    });

    it('keeps a port and a path prefix', () => {
        expect(normalizeBaseUrl('http://localhost:3000/api')).toBe('http://localhost:3000/api');
    });

    it('drops a trailing slash so one server is one stored account', () => {
        expect(normalizeBaseUrl('http://localhost:3000/')).toBe('http://localhost:3000');
    });

    it('rejects a value that would reach a command as a flag', () => {
        expect(() => normalizeBaseUrl('-D')).toThrow(ConfigurationError);
    });

    it('rejects a relative value', () => {
        expect(() => normalizeBaseUrl('localhost:3000')).toThrow(ConfigurationError);
    });

    it('rejects a protocol the browser launcher should never be handed', () => {
        expect(() => normalizeBaseUrl('file:///etc/passwd')).toThrow(ConfigurationError);
    });
});
