import { useState } from 'react';
import { BrandIcon, Button } from '@ctm/ui';
import { MCP_CLIENTS } from '../../lib/mcp-clients.js';

type McpConnectorCardProps = {
    mcpUrl: string;
};

/** Advertises the MCP server URL and installs it into whichever MCP client the user picks. */
export function McpConnectorCard({ mcpUrl }: McpConnectorCardProps): React.JSX.Element {
    const [clientId, setClientId] = useState(MCP_CLIENTS[0]!.id);
    const [copied, setCopied] = useState(false);

    const client = MCP_CLIENTS.find((c) => c.id === clientId) ?? MCP_CLIENTS[0]!;

    const copy = async (text: string): Promise<void> => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const add = async (): Promise<void> => {
        const action = client.buildAction({ mcpUrl });

        if (action.kind === 'deeplink') {
            window.location.href = action.url;
            return;
        }

        if (action.kind === 'copy-command') {
            await copy(action.command);
            return;
        }

        await copy(mcpUrl);
        window.open(action.settingsUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20 shadow-[3px_3px_0px_#111] dark:shadow-none p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="font-black uppercase text-nb-black dark:text-white text-sm tracking-wide flex items-center gap-2">
                        <BrandIcon brand="mcp" />
                        MCP
                    </p>
                    <p className="text-xs font-bold text-nb-black/50 dark:text-white/40 mt-0.5">
                        Read and manage your tasks from any MCP client.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        aria-label="MCP client"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="w-32 border-2 border-nb-black dark:border-white/20 bg-white dark:bg-neutral-800 text-nb-black dark:text-white font-bold text-xs uppercase px-2 py-1.5"
                    >
                        {MCP_CLIENTS.map(({ id, label }) => (
                            <option key={id} value={id}>
                                {label}
                            </option>
                        ))}
                    </select>
                    {/* Label stays fixed — a per-client label resizes the row on every change. */}
                    <Button onClick={() => void add()} aria-label={`Add to ${client.label}`}>
                        Add
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2 border-t-2 border-nb-black/10 dark:border-white/10 pt-3">
                <code
                    data-testid="mcp-url"
                    className="flex-1 truncate font-mono text-xs bg-nb-black/5 dark:bg-white/10 text-nb-black dark:text-white px-2 py-1.5"
                >
                    {mcpUrl}
                </code>
                <Button variant="secondary" onClick={() => void copy(mcpUrl)}>
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>

            {/* Fixed height: hints differ in length and would otherwise resize the card. */}
            <p className="text-xs font-bold text-nb-black/50 dark:text-white/40 flex items-start gap-2 min-h-8">
                <BrandIcon brand={client.brand} size={14} className="mt-px" />
                {client.hint}
            </p>
        </div>
    );
}
