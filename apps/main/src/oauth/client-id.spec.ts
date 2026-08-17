import { describe, it, expect } from 'vitest';
import { isClientIdMetadataDocumentUrl } from './client-id.js';

describe('isClientIdMetadataDocumentUrl', () => {
    it('accepts an https URL with a path component', () => {
        expect(isClientIdMetadataDocumentUrl('https://app.example.com/oauth/client.json')).toBe(true);
    });

    it.each([
        ['an id this server issued', 'client_0123456789abcdef'],
        ['a plain http URL', 'http://app.example.com/client.json'],
        ['an origin with no path', 'https://app.example.com'],
        ['an origin with an empty path', 'https://app.example.com/'],
        ['a URL with a fragment', 'https://app.example.com/client.json#x'],
        ['a URL carrying credentials', 'https://user:pass@app.example.com/client.json'],
        ['a private-use scheme', 'com.example.app:/oauth'],
    ])('rejects %s', (_case, clientId) => {
        expect(isClientIdMetadataDocumentUrl(clientId)).toBe(false);
    });
});
