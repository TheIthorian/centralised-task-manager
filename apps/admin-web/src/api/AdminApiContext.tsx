import { createContext, useContext, useMemo } from 'react';
import { CtmAdminClient } from '@ctm/api-client';
import config from '../config.js';
import { MissingProviderError } from '../lib/errors.js';

const AdminApiContext = createContext<CtmAdminClient | null>(null);

/**
 * Supplies the operator API client.
 *
 * There is no token to hold, so this exists for one reason: a page spec can pass a stub in
 * place of the real client without reaching into module state.
 */
export function AdminApiProvider({
    client,
    children,
}: {
    client?: CtmAdminClient;
    children: React.ReactNode;
}): React.JSX.Element {
    const value = useMemo(() => client ?? new CtmAdminClient({ baseUrl: config.adminApiUrl }), [client]);

    return <AdminApiContext.Provider value={value}>{children}</AdminApiContext.Provider>;
}

/** The operator API client for this tree. */
export function useAdminApi(): CtmAdminClient {
    const client = useContext(AdminApiContext);

    if (!client) throw new MissingProviderError({ hook: 'useAdminApi', provider: 'AdminApiProvider' });

    return client;
}
