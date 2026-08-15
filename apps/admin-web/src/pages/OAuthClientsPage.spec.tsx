import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AdminOAuthClientDto, AvailableScopeDto } from '@ctm/api-client';
import { OAuthClientsPage } from './OAuthClientsPage.js';
import { renderPage, type StubAdminClient } from '../test-utils.js';

const availableScopes: AvailableScopeDto[] = [
    { scope: 'openid', label: 'Verify identity', required: true },
    { scope: 'tasks:read', label: 'Read tasks', required: false },
];

function client(overrides: Partial<AdminOAuthClientDto> = {}): AdminOAuthClientDto {
    return {
        clientId: 'dyn-1',
        clientName: 'Notes App',
        redirectUris: ['https://notes.example.com/callback'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        scopes: ['openid', 'tasks:read'],
        isDynamic: true,
        clientUri: null,
        tosUri: null,
        policyUri: null,
        contacts: [],
        softwareId: null,
        issuedAt: '2026-08-01T10:00:00.000Z',
        lastUsedAt: null,
        ...overrides,
    };
}

function stub(overrides: StubAdminClient = {}): StubAdminClient {
    return {
        listOAuthClients: vi.fn().mockResolvedValue({ clients: [client()], total: 1 }),
        listAvailableScopes: vi.fn().mockResolvedValue(availableScopes),
        ...overrides,
    };
}

describe('OAuthClientsPage', () => {
    it('lists registered clients with their scopes', async () => {
        renderPage({ ui: <OAuthClientsPage />, client: stub() });

        expect(await screen.findByText('Notes App')).toBeInTheDocument();
        expect(screen.getByText('tasks:read')).toBeInTheDocument();
    });

    it('refuses to edit or revoke a client seeded from code', async () => {
        const seeded = client({ clientId: 'ctm-cli', clientName: 'CTM CLI', isDynamic: false });

        renderPage({
            ui: <OAuthClientsPage />,
            client: stub({ listOAuthClients: vi.fn().mockResolvedValue({ clients: [seeded], total: 1 }) }),
        });

        expect(await screen.findByRole('button', { name: 'Edit CTM CLI' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Revoke CTM CLI' })).toBeDisabled();
        expect(screen.getByText('Seeded from code')).toBeInTheDocument();
    });

    it('still lists a seeded client, because its existence is operator information', async () => {
        const seeded = client({ clientId: 'ctm-cli', clientName: 'CTM CLI', isDynamic: false });

        renderPage({
            ui: <OAuthClientsPage />,
            client: stub({ listOAuthClients: vi.fn().mockResolvedValue({ clients: [seeded], total: 1 }) }),
        });

        expect(await screen.findByText('CTM CLI')).toBeInTheDocument();
    });

    it('sends one redirect URI per line when registering a client', async () => {
        const user = userEvent.setup();
        const createOAuthClient = vi.fn().mockResolvedValue(client({ clientName: 'Second App' }));

        renderPage({ ui: <OAuthClientsPage />, client: stub({ createOAuthClient }) });

        await user.click(await screen.findByRole('button', { name: 'Register client' }));
        await user.type(screen.getByLabelText('Name'), 'Second App');
        await user.type(
            screen.getByLabelText('Redirect URIs'),
            'https://a.example.com/cb\nhttps://b.example.com/cb',
        );
        await user.click(screen.getByRole('checkbox', { name: 'Read tasks' }));
        await user.click(screen.getByRole('button', { name: 'Register' }));

        await waitFor(() =>
            expect(createOAuthClient).toHaveBeenCalledWith({
                dto: expect.objectContaining({
                    clientName: 'Second App',
                    redirectUris: ['https://a.example.com/cb', 'https://b.example.com/cb'],
                }),
            }),
        );
    });

    it('rejects a redirect URI that is not a URL before calling the API', async () => {
        const user = userEvent.setup();
        const createOAuthClient = vi.fn();

        renderPage({ ui: <OAuthClientsPage />, client: stub({ createOAuthClient }) });

        await user.click(await screen.findByRole('button', { name: 'Register client' }));
        await user.type(screen.getByLabelText('Name'), 'Bad App');
        await user.type(screen.getByLabelText('Redirect URIs'), 'not-a-url');
        await user.click(screen.getByRole('button', { name: 'Register' }));

        expect(await screen.findByText('not-a-url is not a valid URL.')).toBeInTheDocument();
        expect(createOAuthClient).not.toHaveBeenCalled();
    });

    it('keeps the required scope selected and out of reach', async () => {
        const user = userEvent.setup();

        renderPage({ ui: <OAuthClientsPage />, client: stub() });

        await user.click(await screen.findByRole('button', { name: 'Register client' }));

        const openid = screen.getByRole('checkbox', { name: 'Verify identity' });

        expect(openid).toBeChecked();
        expect(openid).toBeDisabled();
    });

    it('asks for confirmation before revoking, and names what is being revoked', async () => {
        const user = userEvent.setup();
        const revokeOAuthClient = vi.fn().mockResolvedValue(client());

        renderPage({ ui: <OAuthClientsPage />, client: stub({ revokeOAuthClient }) });

        await user.click(await screen.findByRole('button', { name: 'Revoke Notes App' }));

        expect(screen.getByText(/Notes App will no longer be able/)).toBeInTheDocument();
        expect(revokeOAuthClient).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Revoke', exact: true }));

        await waitFor(() => expect(revokeOAuthClient).toHaveBeenCalledWith({ clientId: 'dyn-1' }));
    });

    it('narrows the request to dynamically registered clients when that filter is chosen', async () => {
        const user = userEvent.setup();
        const listOAuthClients = vi.fn().mockResolvedValue({ clients: [client()], total: 1 });

        renderPage({ ui: <OAuthClientsPage />, client: stub({ listOAuthClients }) });

        await user.click(await screen.findByRole('radio', { name: 'Registered' }));

        await waitFor(() => expect(listOAuthClients).toHaveBeenCalledWith(expect.objectContaining({ isDynamic: true })));
    });

    it('reports a failed list inline rather than showing an empty page', async () => {
        renderPage({
            ui: <OAuthClientsPage />,
            client: stub({ listOAuthClients: vi.fn().mockRejectedValue(new Error('client list is down')) }),
        });

        expect(await screen.findByText('client list is down')).toBeInTheDocument();
    });
});
