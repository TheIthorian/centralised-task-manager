import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.js';
import { Button } from '@ctm/ui';

type NotionSetupModalProps = {
    connectionId: string;
    onComplete: () => void;
    onClose: () => void;
};

/** Post-OAuth setup modal: lets the user pick which Notion database to sync. */
export function NotionSetupModal({ connectionId, onComplete, onClose }: NotionSetupModalProps): React.JSX.Element {
    const { api } = useAuth();
    const [selectedId, setSelectedId] = useState<string>('');

    const {
        data: databases = [],
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['notion-databases', connectionId],
        queryFn: () => api.listNotionDatabases({ connectionId }),
    });

    const saveMutation = useMutation({
        mutationFn: () => api.setConnectionDetails({ connectionId, details: { databaseId: selectedId } }),
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
            <div className="bg-panel border border-line shadow-[4px_4px_0px_#111] p-6 max-w-md w-full mx-4 rounded-ctm">
                <h2 className="text-lg font-semibold text-fg mb-1">
                    Select Notion Database
                </h2>
                <p className="text-sm font-medium text-muted mb-4">
                    Choose the database where your tasks live.
                </p>

                {isLoading && (
                    <p className="font-medium text-muted text-sm uppercase">
                        Loading databases…
                    </p>
                )}

                {isError && (
                    <p className="font-medium text-warn text-sm">Failed to load databases. Please try again.</p>
                )}

                {!isLoading && !isError && databases.length === 0 && (
                    <div className="mb-4">
                        <p className="font-medium text-muted text-sm mb-3">
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
                                className={`flex items-center gap-3 p-3 border-2 cursor-pointer font-medium text-sm ${
                                    selectedId === db.id
                                        ? 'border-line dark:border-white bg-accent/30 dark:bg-accent/10 text-fg'
                                        : 'border-line/20  hover:border-line dark:hover:border-white text-fg'
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
                    <p className="font-medium text-warn text-sm mb-3">Failed to save. Please try again.</p>
                )}

                <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={() => saveMutation.mutate()} disabled={!selectedId || saveMutation.isPending}>
                        {saveMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
