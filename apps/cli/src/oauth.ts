import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import open from 'open';

export type PkceChallenge = {
    codeVerifier: string;
    codeChallenge: string;
};

/** Generate a PKCE code_verifier and its SHA-256 base64url code_challenge. */
export function generatePkce(): PkceChallenge {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
}

const SUCCESS_HTML = `<!DOCTYPE html><html><body>
<h2>Authorised successfully</h2>
<p>You can close this tab and return to the terminal.</p>
</body></html>`;

const ERROR_HTML = (msg: string): string => `<!DOCTYPE html><html><body>
<h2>Authorisation failed</h2>
<p>${msg}</p>
</body></html>`;

export type CallbackServer = {
    server: http.Server;
    port: number;
    waitForCode: () => Promise<string>;
};

const CLI_SCOPES =
    'openid tasks:read tasks:write connectors:read connectors:write notifications:read notification-config:read notification-config:write profile:read';

/** Registered by `apps/main` at boot, so the CLI never registers itself. */
export const CLI_CLIENT_ID = 'ctm-cli';

type OAuthTokenResponse = {
    access_token: string;
    refresh_token: string;
    id_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
};

/** Exchange a PKCE authorization code for tokens. */
export async function exchangeCodeForTokens({
    baseUrl,
    code,
    redirectUri,
    codeVerifier,
}: {
    baseUrl: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
}): Promise<OAuthTokenResponse> {
    const res = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        }),
    });

    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);

    return (await res.json()) as OAuthTokenResponse;
}

type OAuthLoginResult = {
    accessToken: string;
    refreshToken: string;
    clientId: string;
};

/**
 * Full OAuth 2.0 + PKCE loopback login flow.
 * Opens the browser, waits for the callback, exchanges the code.
 */
export async function performOAuthLogin({
    baseUrl,
    clientId,
    timeoutMs = 5 * 60 * 1000,
}: {
    baseUrl: string;
    clientId: string;
    timeoutMs?: number;
}): Promise<OAuthLoginResult> {
    const { codeVerifier, codeChallenge } = generatePkce();
    const { server, port, waitForCode } = await startCallbackServer();
    const redirectUri = `http://127.0.0.1:${port}/callback`;

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        scope: CLI_SCOPES,
    });

    const authorizeUrl = `${baseUrl}/oauth/authorize?${params.toString()}`;

    console.log(`\nOpening browser for authorisation…`);
    console.log(`If it did not open, visit:\n  ${authorizeUrl}\n`);

    await open(authorizeUrl);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const code = await Promise.race([
        waitForCode(),
        new Promise<never>(
            (_, reject) =>
                (timeoutId = setTimeout(() => reject(new Error('Authorisation timed out after 5 minutes')), timeoutMs)),
        ),
    ]).finally(() => {
        clearTimeout(timeoutId);
        server.close();
    });

    const tokens = await exchangeCodeForTokens({ baseUrl, code, redirectUri, codeVerifier });

    return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        clientId,
    };
}

/** Start a one-shot local HTTP server that captures the OAuth callback code. */
export async function startCallbackServer(): Promise<CallbackServer> {
    let resolve: (code: string) => void;
    let reject: (err: Error) => void;

    const codePromise = new Promise<string>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', `http://127.0.0.1`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(ERROR_HTML(error));
            reject(new Error(error));
            return;
        }

        if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(SUCCESS_HTML);
            resolve(code);
            return;
        }

        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing code or error parameter');
    });

    await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));

    const port = (server.address() as AddressInfo).port;

    return { server, port, waitForCode: () => codePromise };
}
