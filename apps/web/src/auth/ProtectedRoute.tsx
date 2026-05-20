import { Navigate } from 'react-router';
import { useAuth } from './AuthContext.js';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/** Redirects to /login if user is not authenticated. Shows nothing while loading. */
export function ProtectedRoute({ children }: ProtectedRouteProps): React.JSX.Element | null {
    const { user, isLoading } = useAuth();

    if (isLoading) return null;

    if (!user) return <Navigate to="/login" replace />;

    return <>{children}</>;
}
