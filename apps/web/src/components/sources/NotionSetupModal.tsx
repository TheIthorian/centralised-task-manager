import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.js';
import { Button } from '../ui/index.js';

type NotionSetupModalProps = {
    source: string;
    onComplete: () => void;
    onClose: () => void;
};

/** Post-OAuth setup modal: lets the user pick which Notion database to sync. */
export function NotionSetupModal({ source, onComplete, onClose }: NotionSetupModalProps): React.JSX.Element {
    const { api } = useAuth();
    const [selectedId, setSelectedId] = useState<string>('');

    const { data: databases = [], isLoading, isError } = useQuery({
        queryKey: ['notion-databases'],
        queryFn: () => api.listNotionDatabases(),
    });

    const saveMutation = useMutation({
        mutationFn: () =>
            api.setConnectionDetails({ source, details: { databaseId: selectedId } }),
        onSuccess: () => {
            onComplete();
        },
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20 shadow-[4px_4px_0px_#111] p-6 max-w-md w-full mx-4">
                <h2 className="text-lg font-black uppercase text-nb-black dark:text-white mb-1">
                    Select Notion Database
                </h2>
                <p className="text-sm font-bold text-nb-black/60 dark:text-white/50 mb-4">
                    Choose the database where your tasks live.
                </p>

                {isLoading && (
                    <p className="font-bold text-nb-black/60 dark:text-white/50 text-sm uppercase">Loading databases…</p>
                )}

                {isError && (
                    <p className="font-bold text-nb-red text-sm">Failed to load databases. Please try again.</p>
                )}

                {!isLoading && !isError && databases.length === 0 && (
                    <div className="mb-4">
                        <p className="font-bold text-nb-black/60 dark:text-white/50 text-sm mb-3">
                            No databases found. Share a database with your Notion integration first.
                        </p>
                        <div className="flex justify-end">
                            <Button variant="secondary" onClick={onClose}>
                                Close
                            </Button>
                        </div>
                    </div>
                )}

                {!isLoading && !isError && databases.length > 0 && (
                    <div className="flex flex-col gap-2 mb-4 max-h-60 overflow-y-auto">
                        {databases.map((db: { id: string; name: string }) => (
                            <label
                                key={db.id}
                                className={`flex items-center gap-3 p-3 border-2 cursor-pointer font-bold text-sm ${
                                    selectedId === db.id
                                        ? 'border-nb-black dark:border-white bg-nb-yellow/30 dark:bg-nb-yellow/10 text-nb-black dark:text-white'
                                        : 'border-nb-black/20 dark:border-white/20 hover:border-nb-black dark:hover:border-white text-nb-black dark:text-white'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="database"
                                    value={db.id}
                                    checked={selectedId === db.id}
                                    onChange={() => setSelectedId(db.id)}
                                    className="sr-only"
                                />
                                {db.name}
                            </label>
                        ))}
                    </div>
                )}

                {saveMutation.isError && (
                    <p className="font-bold text-nb-red text-sm mb-3">Failed to save. Please try again.</p>
                )}

                <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={!selectedId || saveMutation.isPending}
                    >
                        {saveMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
