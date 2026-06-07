import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ImportResponseDto } from '@ctm/api-client';
import { Button } from '@ctm/ui';
import { useAuth } from '../../auth/AuthContext.js';
import { getErrorMessage } from '../../api/error-message.js';

type OnConflict = 'replace' | 'ignore';

/** Trigger a browser download for an in-memory Blob. */
function triggerDownload({ blob, filename }: { blob: Blob; filename: string }): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

/** Settings section: export all user data to JSON, and import it back. */
export function DataSection(): React.JSX.Element {
    const { api } = useAuth();

    // ── Export ────────────────────────────────────────────────────────────
    const exportMutation = useMutation({
        mutationFn: async (): Promise<number> => {
            const { exportId, files } = await api.exportData();

            for (const file of files) {
                const blob = await api.downloadExportFile({ exportId, filename: file.filename });

                triggerDownload({ blob, filename: file.filename });
            }

            return files.length;
        },
    });

    // ── Import ────────────────────────────────────────────────────────────
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [onConflict, setOnConflict] = useState<OnConflict>('ignore');
    const [summary, setSummary] = useState<ImportResponseDto | null>(null);

    const importMutation = useMutation({
        mutationFn: (): Promise<ImportResponseDto> => api.importData({ files, onConflict }),
        onSuccess: (result) => {
            setSummary(result);
            setFiles([]);

            if (fileInputRef.current) fileInputRef.current.value = '';
        },
    });

    return (
        <div className="bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20 shadow-[3px_3px_0px_#111] dark:shadow-none p-5 mb-8">
            <h2 className="font-black uppercase text-sm tracking-wide text-nb-black dark:text-white mb-1">
                Your Data
            </h2>
            <p className="text-nb-black/60 dark:text-white/50 font-bold text-xs mb-4">
                Export all your tasks, notifications, and profile as JSON, or import them back.
            </p>

            {/* Export */}
            <div className="mb-6">
                <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
                    {exportMutation.isPending ? 'Exporting…' : 'Export My Data'}
                </Button>

                {exportMutation.isSuccess && (
                    <p className="text-nb-green font-bold text-sm mt-2">
                        Downloaded {exportMutation.data} file{exportMutation.data === 1 ? '' : 's'}.
                    </p>
                )}

                {exportMutation.isError && (
                    <p className="text-nb-red font-bold text-sm mt-2">
                        {getErrorMessage(exportMutation.error, 'Export failed. Please try again.')}
                    </p>
                )}
            </div>

            {/* Import */}
            <div className="border-t-2 border-nb-black/10 dark:border-white/10 pt-4">
                <p className="font-black uppercase text-xs tracking-wide text-nb-black dark:text-white mb-2">
                    Import Data
                </p>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                    className="block w-full text-sm font-bold text-nb-black dark:text-white mb-3 file:mr-3 file:border-2 file:border-nb-black file:bg-white file:px-3 file:py-1 file:font-black file:uppercase file:text-xs dark:file:border-white/20 dark:file:bg-neutral-800 dark:file:text-white"
                />

                <fieldset className="mb-3">
                    <legend className="font-black uppercase text-xs tracking-wide text-nb-black dark:text-white mb-1">
                        On Conflict
                    </legend>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 font-bold text-sm text-nb-black dark:text-white">
                            <input
                                type="radio"
                                name="onConflict"
                                value="ignore"
                                checked={onConflict === 'ignore'}
                                onChange={() => setOnConflict('ignore')}
                            />
                            Ignore existing
                        </label>
                        <label className="flex items-center gap-2 font-bold text-sm text-nb-black dark:text-white">
                            <input
                                type="radio"
                                name="onConflict"
                                value="replace"
                                checked={onConflict === 'replace'}
                                onChange={() => setOnConflict('replace')}
                            />
                            Replace existing
                        </label>
                    </div>
                </fieldset>

                <Button
                    onClick={() => importMutation.mutate()}
                    disabled={files.length === 0 || importMutation.isPending}
                >
                    {importMutation.isPending ? 'Importing…' : 'Import'}
                </Button>

                {importMutation.isError && (
                    <p className="text-nb-red font-bold text-sm mt-2">
                        {getErrorMessage(importMutation.error, 'Import failed. Please try again.')}
                    </p>
                )}

                {summary && (
                    <p className="text-nb-green font-bold text-sm mt-2">
                        Imported {summary.imported.tasks} task{summary.imported.tasks === 1 ? '' : 's'} and{' '}
                        {summary.imported.notifications} notification
                        {summary.imported.notifications === 1 ? '' : 's'}. Skipped {summary.skipped.tasks} task
                        {summary.skipped.tasks === 1 ? '' : 's'} and {summary.skipped.notifications} notification
                        {summary.skipped.notifications === 1 ? '' : 's'}.
                    </p>
                )}
            </div>
        </div>
    );
}
