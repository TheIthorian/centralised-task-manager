import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { OAuthConsentPage } from './OAuthConsentPage.js';

function renderConsentPage(search: string): ReturnType<typeof render> {
    return render(
        <MemoryRouter initialEntries={[`/oauth/consent${search}`]}>
            <Routes>
                <Route path="/oauth/consent" element={<OAuthConsentPage />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('OAuthConsentPage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the requesting access header', () => {
        renderConsentPage('?scope=tasks:read+tasks:write&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code');
        expect(screen.getByText(/requesting access/i)).toBeInTheDocument();
    });

    it('renders scope groups from the scope query param', () => {
        renderConsentPage('?scope=tasks:read+tasks:write+notifications:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code');
        expect(screen.getByText('Tasks')).toBeInTheDocument();
        expect(screen.getByText('Notifications')).toBeInTheDocument();
        expect(screen.getByText('Read tasks')).toBeInTheDocument();
    });

    it('renders openid as locked/required', () => {
        renderConsentPage('?scope=openid+tasks:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code');
        expect(screen.getByText(/required/i)).toBeInTheDocument();
    });

    it('allows toggling a scope off', () => {
        renderConsentPage('?scope=tasks:read+tasks:write&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code');
        const writeCheckbox = screen.getByRole('checkbox', { name: /create & manage tasks/i });
        expect(writeCheckbox).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(writeCheckbox);
        expect(writeCheckbox).toHaveAttribute('aria-checked', 'false');
    });

    it('shows error message on invalid credentials', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false }));
        renderConsentPage('?scope=tasks:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code');
        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@example.com' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
        fireEvent.click(screen.getByRole('button', { name: /authorise/i }));
        await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument());
    });

    it('redirects browser on successful authorisation', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            status: 302,
            ok: false,
            headers: { get: (h: string) => (h === 'location' ? 'http://localhost:4000/cb?code=abc123' : null) },
        });
        vi.stubGlobal('fetch', mockFetch);
        const assignSpy = vi.fn();
        Object.defineProperty(window, 'location', { value: { assign: assignSpy }, writable: true });

        renderConsentPage('?scope=tasks:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code');
        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass' } });
        fireEvent.click(screen.getByRole('button', { name: /authorise/i }));

        await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('http://localhost:4000/cb?code=abc123'));
    });
});
