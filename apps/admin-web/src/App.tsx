import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminApiProvider } from './api/AdminApiContext.js';
import { AppShell } from './components/AppShell.js';
import { AuditLogPage } from './pages/AuditLogPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ErrorPage } from './pages/ErrorPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { OAuthClientsPage } from './pages/OAuthClientsPage.js';
import { ToastProvider } from './toast/ToastContext.js';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 30_000,
        },
    },
});

const router = createBrowserRouter([
    {
        path: '/',
        element: <AppShell />,
        errorElement: <ErrorPage />,
        children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard', element: <DashboardPage /> },
            { path: 'clients', element: <OAuthClientsPage /> },
            { path: 'audit', element: <AuditLogPage /> },
        ],
    },
    { path: '*', element: <NotFoundPage /> },
]);

/**
 * There is no login route and no auth guard. Cloudflare Access decides whether this document is
 * served at all, so by the time React runs the operator is already authenticated.
 */
export default function App(): React.JSX.Element {
    return (
        <QueryClientProvider client={queryClient}>
            <AdminApiProvider>
                <ToastProvider>
                    <RouterProvider router={router} />
                </ToastProvider>
            </AdminApiProvider>
        </QueryClientProvider>
    );
}
