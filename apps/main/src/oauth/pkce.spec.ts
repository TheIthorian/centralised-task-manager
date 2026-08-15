import { describe, it, expect } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import {
    CODE_CHALLENGE_METHODS,
    codeChallengeMethodSchema,
    isSupportedCodeChallengeMethod,
    verifyCodeChallenge,
} from './pkce.js';

describe('PKCE', () => {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    it('supports S256 only', () => {
        expect(CODE_CHALLENGE_METHODS).toEqual(['S256']);
    });

    it('accepts a verifier whose S256 digest is the challenge', () => {
        expect(
            verifyCodeChallenge({ codeVerifier: verifier, codeChallenge: challenge, codeChallengeMethod: 'S256' }),
        ).toBe(true);
    });

    it('rejects a verifier that hashes to something else', () => {
        const other = randomBytes(32).toString('base64url');

        expect(
            verifyCodeChallenge({ codeVerifier: other, codeChallenge: challenge, codeChallengeMethod: 'S256' }),
        ).toBe(false);
    });

    it('rejects a plain-style verifier sent as the challenge itself', () => {
        expect(
            verifyCodeChallenge({ codeVerifier: verifier, codeChallenge: verifier, codeChallengeMethod: 'S256' }),
        ).toBe(false);
    });

    it.each(['plain', 's256', '', 'S512'])('does not recognise %j as a method', (method) => {
        expect(isSupportedCodeChallengeMethod(method)).toBe(false);
        expect(codeChallengeMethodSchema.safeParse(method).success).toBe(false);
    });

    it('recognises S256', () => {
        expect(isSupportedCodeChallengeMethod('S256')).toBe(true);
        expect(codeChallengeMethodSchema.safeParse('S256').success).toBe(true);
    });
});
