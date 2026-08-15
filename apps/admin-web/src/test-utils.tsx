import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { CtmAdminClient } from '@ctm/api-client';
import { AdminApiProvider } from './api/AdminApiContext.js';
import { ToastProvider } from './toast/ToastContext.js';

/**
 * A stub only has to answer the calls the page under test makes, so it is described as a partial
 * and widened once, here, rather than at every call site.
 */
export type StubAdminClient = Partial<CtmAdminClient>;

/** Render a page with the providers it expects and a stub in place of the real API client. */
export function renderPage({ ui, client }: { ui: React.ReactNode; client: StubAdminClient }): RenderResult {
    // Retries would turn an asserted failure into a four-second wait for the same failure.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return render(
        <QueryClientProvider client={queryClient}>
            <AdminApiProvider client={client as CtmAdminClient}>
                <ToastProvider>
                    <MemoryRouter>{ui}</MemoryRouter>
                </ToastProvider>
            </AdminApiProvider>
        </QueryClientProvider>,
    );
}
