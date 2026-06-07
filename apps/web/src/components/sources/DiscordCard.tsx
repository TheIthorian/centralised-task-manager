import type { DiscordStatusDto } from '@ctm/api-client';
import { Button } from '@ctm/ui';

type DiscordCardProps = {
    status: DiscordStatusDto;
    onConnect: () => void;
    onDisconnect: () => void;
    onTest: () => void;
    isPending: boolean;
    testSent?: boolean;
};

/** Displays the Discord notification connector with connect / disconnect / test actions. */
export function DiscordCard({
    status,
    onConnect,
    onDisconnect,
    onTest,
    isPending,
    testSent,
}: DiscordCardProps): React.JSX.Element {
    return (
        <div className="bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20 shadow-[3px_3px_0px_#111] dark:shadow-none p-4 flex items-center justify-between gap-4">
            <div>
                <p className="font-black uppercase text-nb-black dark:text-white text-sm tracking-wide">Discord</p>
                {status.connected ? (
                    <p className="text-xs font-bold text-nb-black/50 dark:text-white/40 mt-0.5">
                        Connected{status.discordUserId ? ` (${status.discordUserId})` : ''}
                    </p>
                ) : (
                    <p className="text-xs font-bold text-nb-black/50 dark:text-white/40 mt-0.5">Not connected</p>
                )}
                {testSent && (
                    <p className="text-xs font-bold text-green-600 dark:text-green-400 mt-0.5">Test message sent!</p>
                )}
            </div>

            <div className="flex items-center gap-2">
                {status.connected && (
                    <Button variant="secondary" onClick={onTest} disabled={isPending}>
                        Test
                    </Button>
                )}
                {status.connected ? (
                    <Button variant="danger" onClick={onDisconnect} disabled={isPending}>
                        Disconnect
                    </Button>
                ) : (
                    <Button onClick={onConnect} disabled={isPending}>
                        Connect
                    </Button>
                )}
            </div>
        </div>
    );
}
