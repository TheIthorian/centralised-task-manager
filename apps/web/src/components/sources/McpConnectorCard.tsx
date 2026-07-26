import { useState } from 'react';
import { Button } from '@ctm/ui';

type McpConnectorCardProps = {
    mcpUrl: string;
};

/** Where Claude's custom-connector dialog lives; the URL still has to be pasted in by hand. */
const CLAUDE_CONNECTORS_URL = 'https://claude.ai/settings/connectors';

/** Advertises the MCP server URL so AI clients such as Claude can be pointed at it. */
export function McpConnectorCard({ mcpUrl }: McpConnectorCardProps): React.JSX.Element {
    const [copied, setCopied] = useState(false);

    const copy = async (): Promise<void> => {
        await navigator.clipboard.writeText(mcpUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const addToClaude = async (): Promise<void> => {
        await copy();
        window.open(CLAUDE_CONNECTORS_URL, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20 shadow-[3px_3px_0px_#111] dark:shadow-none p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="font-black uppercase text-nb-black dark:text-white text-sm tracking-wide">MCP</p>
                    <p className="text-xs font-bold text-nb-black/50 dark:text-white/40 mt-0.5">
                        Read and manage your tasks from any MCP client.
                    </p>
                </div>

                <Button onClick={() => void addToClaude()}>Add to Claude</Button>
            </div>

            <div className="flex items-center gap-2 border-t-2 border-nb-black/10 dark:border-white/10 pt-3">
                <code
                    data-testid="mcp-url"
                    className="flex-1 truncate font-mono text-xs bg-nb-black/5 dark:bg-white/10 text-nb-black dark:text-white px-2 py-1.5"
                >
                    {mcpUrl}
                </code>
                <Button variant="secondary" onClick={() => void copy()}>
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>

            <p className="text-xs font-bold text-nb-black/50 dark:text-white/40">
                In Claude, choose “Add custom connector” and paste this URL. You will be asked to sign in and approve
                access.
            </p>
        </div>
    );
}
