import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataSection } from './DataSection.js';

const mockApi = {
    exportData: vi.fn(),
    downloadExportFile: vi.fn(),
    importData: vi.fn(),
};

vi.mock('../../auth/AuthContext.js', () => ({
    useAuth: () => ({ api: mockApi }),
}));

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('DataSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        URL.createObjectURL = vi.fn(() => 'blob:mock');
        URL.revokeObjectURL = vi.fn();
    });

    it('exports data and downloads each file', async () => {
        mockApi.exportData.mockResolvedValue({
            exportId: 'uuid-1',
            files: [
                { filename: 'export-part-1.json', sizeBytes: 1, contentType: 'application/json', sha256: 'a' },
                { filename: 'export-part-2.json', sizeBytes: 1, contentType: 'application/json', sha256: 'b' },
            ],
        });
        mockApi.downloadExportFile.mockResolvedValue(new Blob(['{}']));

        render(<DataSection />, { wrapper });

        await userEvent.click(screen.getByRole('button', { name: /export my data/i }));

        await waitFor(() => {
            expect(mockApi.exportData).toHaveBeenCalled();
            expect(mockApi.downloadExportFile).toHaveBeenCalledTimes(2);
        });
        expect(screen.getByText(/downloaded 2 files/i)).toBeInTheDocument();
    });

    it('import button is disabled until files are selected', () => {
        render(<DataSection />, { wrapper });
        expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled();
    });

    it('imports selected files with chosen conflict strategy and shows summary', async () => {
        mockApi.importData.mockResolvedValue({
            imported: { tasks: 3, notifications: 1 },
            skipped: { tasks: 2, notifications: 0 },
        });

        render(<DataSection />, { wrapper });

        const file = new File(['{}'], 'export-part-1.json', { type: 'application/json' });
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        await userEvent.upload(input, file);

        await userEvent.click(screen.getByLabelText(/replace existing/i));
        await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

        await waitFor(() => {
            expect(mockApi.importData).toHaveBeenCalledWith({
                files: [file],
                onConflict: 'replace',
            });
        });
        expect(screen.getByText(/imported 3 tasks and 1 notification/i)).toBeInTheDocument();
    });
});
