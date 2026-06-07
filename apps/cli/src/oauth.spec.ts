import { describe, it, expect } from 'vitest';
import { generatePkce, startCallbackServer } from './oauth.js';
import http from 'node:http';

describe('generatePkce', () => {
    it('returns a code_verifier and code_challenge', () => {
        const { codeVerifier, codeChallenge } = generatePkce();
        expect(codeVerifier).toBeTruthy();
        expect(codeChallenge).toBeTruthy();
    });

    it('code_challenge is SHA-256 base64url of code_verifier', async () => {
        const { codeVerifier, codeChallenge } = generatePkce();
        const { createHash } = await import('node:crypto');
        const expected = createHash('sha256').update(codeVerifier).digest('base64url');
        expect(codeChallenge).toBe(expected);
    });

    it('generates unique values each call', () => {
        const a = generatePkce();
        const b = generatePkce();
        expect(a.codeVerifier).not.toBe(b.codeVerifier);
    });
});

describe('startCallbackServer', () => {
    it('resolves with code when callback receives code param', async () => {
        const { server, port, waitForCode } = await startCallbackServer();

        const codePromise = waitForCode();

        await new Promise<void>((resolve, reject) => {
            http.get(`http://127.0.0.1:${port}/callback?code=testcode123&state=abc`, (res) => {
                res.resume();
                res.on('end', resolve);
            }).on('error', reject);
        });

        const code = await codePromise;
        expect(code).toBe('testcode123');
        server.close();
    });

    it('rejects with error when callback receives error param', async () => {
        const { server, port, waitForCode } = await startCallbackServer();

        const codePromise = waitForCode();
        // Suppress unhandled-rejection before the assertion attaches its handler
        codePromise.catch(() => undefined);

        await new Promise<void>((resolve, reject) => {
            http.get(`http://127.0.0.1:${port}/callback?error=access_denied`, (res) => {
                res.resume();
                res.on('end', resolve);
            }).on('error', reject);
        });

        await expect(codePromise).rejects.toThrow('access_denied');
        server.close();
    });
});
