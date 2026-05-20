import type { ConnectorStatusDto } from '@ctm/api-client';
import { Button } from '../ui/index.js';

interface SourceCardProps {
    connector: ConnectorStatusDto;
    onConnect: (source: string) => void;
    onDisconnect: (source: string) => void;
    isPending: boolean;
}

/** Displays a single connector (e.g. Todoist) with connect / disconnect action. */
export function SourceCard({ connector, onConnect, onDisconnect, isPending }: SourceCardProps): React.JSX.Element {
    const { source, connected, lastSynced } = connector;

    return (
        <div className="bg-white border-2 border-nb-black shadow-[3px_3px_0px_#111] p-4 flex items-center justify-between gap-4">
            <div>
                <p className="font-black uppercase text-nb-black text-sm tracking-wide">{source}</p>
                {connected && lastSynced && (
                    <p className="text-xs font-bold text-nb-black/50 mt-0.5">
                        Last synced: {new Date(lastSynced).toLocaleDateString()}
                    </p>
                )}
                {!connected && <p className="text-xs font-bold text-nb-black/50 mt-0.5">Not connected</p>}
            </div>

            {connected ? (
                <Button variant="danger" onClick={() => onDisconnect(source)} disabled={isPending}>
                    Disconnect
                </Button>
            ) : (
                <Button onClick={() => onConnect(source)} disabled={isPending}>
                    Connect
                </Button>
            )}
        </div>
    );
}
