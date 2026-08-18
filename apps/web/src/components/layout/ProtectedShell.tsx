import { ProtectedRoute } from '../../auth/ProtectedRoute.js';
import { AppShell } from './AppShell.js';

/** The authenticated layout and its guard, as one component the router can load on demand. */
export function ProtectedShell(): React.JSX.Element {
    return (
        <ProtectedRoute>
            <AppShell />
        </ProtectedRoute>
    );
}
