import { createBrowserRouter, Outlet, RouterProvider, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext.js';
import { RouteFallback } from './components/layout/RouteFallback.js';
import { ToastProvider } from './toast/ToastContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { ErrorPage } from './pages/ErrorPage.js';

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
        // Pathless root: gives every lazy route below it one place to find a fallback for the
        // first paint, before its chunk has arrived.
        element: <Outlet />,
        HydrateFallback: RouteFallback,
        // Every route below is lazy, so every route can fail on a chunk that a deploy has
        // replaced. The boundary sits above all of them rather than only over the shell.
        errorElement: <ErrorPage />,
        children: [
            { path: '/login', element: <LoginPage /> },
            { path: '/register', lazy: async () => ({ Component: (await import('./pages/RegisterPage.js')).RegisterPage }) },
            {
                path: '/oauth/consent',
                lazy: async () => ({ Component: (await import('./pages/OAuthConsentPage.js')).OAuthConsentPage }),
            },
            {
                path: '/',
                lazy: async () => ({ Component: (await import('./components/layout/ProtectedShell.js')).ProtectedShell }),
                children: [
                    { index: true, element: <Navigate to="/tasks" replace /> },
                    { path: 'tasks', lazy: async () => ({ Component: (await import('./pages/TasksPage.js')).TasksPage }) },
                    {
                        path: 'calendar',
                        lazy: async () => ({ Component: (await import('./pages/CalendarPage.js')).CalendarPage }),
                    },
                    {
                        path: 'timeline',
                        lazy: async () => ({ Component: (await import('./pages/TimelinePage.js')).TimelinePage }),
                    },
                    {
                        path: 'settings',
                        lazy: async () => ({ Component: (await import('./pages/SettingsLayout.js')).SettingsLayout }),
                        children: [
                            { index: true, element: <Navigate to="/settings/connectors" replace /> },
                            {
                                path: 'connectors',
                                lazy: async () => ({
                                    Component: (await import('./pages/ConnectorsPage.js')).ConnectorsPage,
                                }),
                            },
                            // Kept so old links and post-OAuth redirects still land somewhere.
                            { path: 'sources', element: <Navigate to="/settings/connectors" replace /> },
                            {
                                path: 'profile',
                                lazy: async () => ({ Component: (await import('./pages/ProfilePage.js')).ProfilePage }),
                            },
                            {
                                path: 'notifications',
                                lazy: async () => ({
                                    Component: (await import('./pages/NotificationsPage.js')).NotificationsPage,
                                }),
                            },
                            {
                                path: 'authorized-apps',
                                lazy: async () => ({
                                    Component: (await import('./pages/AuthorizedAppsPage.js')).AuthorizedAppsPage,
                                }),
                            },
                        ],
                    },
                ],
            },
            {
                path: '*',
                lazy: async () => ({ Component: (await import('./pages/NotFoundPage.js')).NotFoundPage }),
            },
        ],
    },
]);

export default function App(): React.JSX.Element {
    return (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <AuthProvider>
                    <RouterProvider router={router} />
                </AuthProvider>
            </ToastProvider>
        </QueryClientProvider>
    );
}
