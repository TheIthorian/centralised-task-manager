/** Server name written into a client's MCP config when it supports a one-click install. */
const SERVER_NAME = 'ctm';

/**
 * What clicking "Add to <client>" does.
 *
 * `deeplink` clients register a URL handler that writes the server into their own config.
 * The rest have no install link, so the URL (or CLI command) is copied and the client's
 * connector settings are opened for the user to paste into.
 */
export type McpClientAction =
    | { kind: 'deeplink'; url: string }
    | { kind: 'copy-url'; settingsUrl: string }
    | { kind: 'copy-command'; command: string };

export type McpClient = {
    id: string;
    label: string;
    favicon: string;
    /** How to add the server to this client. */
    buildAction: (params: { mcpUrl: string }) => McpClientAction;
    /** Shown under the card so the user knows what the button did. */
    hint: string;
};

/** Cursor takes a base64-encoded JSON config; `btoa` is safe here because URLs are ASCII. */
function cursorDeeplink({ mcpUrl }: { mcpUrl: string }): string {
    const config = btoa(JSON.stringify({ url: mcpUrl }));

    return `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_NAME}&config=${encodeURIComponent(config)}`;
}

function vsCodeDeeplink({ mcpUrl }: { mcpUrl: string }): string {
    const config = JSON.stringify({ name: SERVER_NAME, type: 'http', url: mcpUrl });

    return `vscode:mcp/install?${encodeURIComponent(config)}`;
}

export const MCP_CLIENTS: McpClient[] = [
    {
        id: 'claude',
        label: 'Claude',
        favicon: '/favicons/claude.png',
        buildAction: () => ({ kind: 'copy-url', settingsUrl: 'https://claude.ai/settings/connectors' }),
        hint: 'URL copied. In Claude, choose “Add custom connector” and paste it, then sign in to approve access.',
    },
    {
        id: 'claude-code',
        label: 'Claude Code',
        favicon: '/favicons/claude.png',
        buildAction: ({ mcpUrl }) => ({
            kind: 'copy-command',
            command: `claude mcp add --transport http ${SERVER_NAME} ${mcpUrl}`,
        }),
        hint: 'Command copied. Run it in your terminal, then `/mcp` in Claude Code to sign in.',
    },
    {
        id: 'cursor',
        label: 'Cursor',
        favicon: '/favicons/cursor.png',
        buildAction: ({ mcpUrl }) => ({ kind: 'deeplink', url: cursorDeeplink({ mcpUrl }) }),
        hint: 'Cursor will ask you to confirm the install, then sign in.',
    },
    {
        id: 'vscode',
        label: 'VS Code',
        favicon: '/favicons/vscode.png',
        buildAction: ({ mcpUrl }) => ({ kind: 'deeplink', url: vsCodeDeeplink({ mcpUrl }) }),
        hint: 'VS Code will ask you to confirm the install, then sign in.',
    },
    {
        id: 'chatgpt',
        label: 'ChatGPT',
        favicon: '/favicons/chatgpt.png',
        buildAction: () => ({ kind: 'copy-url', settingsUrl: 'https://chatgpt.com/#settings/Connectors' }),
        hint: 'URL copied. In ChatGPT, add a connector and paste it, then sign in to approve access.',
    },
];
