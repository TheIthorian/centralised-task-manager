import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext.js';
import { ProtectedRoute } from './auth/ProtectedRoute.js';
import { AppShell } from './components/layout/AppShell.js';
import { ToastProvider } from './toast/ToastContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { SettingsLayout } from './pages/SettingsLayout.js';
import { SourcesPage } from './pages/SourcesPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 30_000,
        },
    },
});

const router = createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    { path: '/register', element: <RegisterPage /> },
    {
        path: '/',
        element: (
            <ProtectedRoute>
                <AppShell />
            </ProtectedRoute>
        ),
        children: [
            { index: true, element: <Navigate to="/tasks" replace /> },
            { path: 'tasks', element: <TasksPage /> },
            {
                path: 'settings',
                element: <SettingsLayout />,
                children: [
                    { index: true, element: <Navigate to="/settings/sources" replace /> },
                    { path: 'sources', element: <SourcesPage /> },
                    { path: 'profile', element: <ProfilePage /> },
                ],
            },
        ],
    },
    { path: '*', element: <NotFoundPage /> },
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
