import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.js';
import { getErrorMessage } from '../api/error-message.js';
import { Button, Input } from '@ctm/ui';

/** Full-page login form on yellow background. */
export function LoginPage(): React.JSX.Element {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnTo = searchParams.get('return') ?? '/tasks';
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            await navigate(returnTo);
        } catch (error) {
            setError(getErrorMessage(error, 'Invalid email or password.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-panel border border-line shadow-[6px_6px_0px_#111] p-8">
                <h1 className="text-3xl font-semibold tracking-tight text-fg mb-6">
                    CTM Login
                </h1>

                {error && (
                    <div className="border border-warn bg-warn-bg p-3 mb-4">
                        <p className="text-warn font-bold text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                    />
                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                    />
                    <Button type="submit" disabled={loading} className="w-full mt-2">
                        {loading ? 'Logging in…' : 'Login'}
                    </Button>
                </form>

                <p className="mt-4 text-center text-sm font-bold text-fg">
                    No account?{' '}
                    <Link to="/register" className="underline font-semibold">
                        Register →
                    </Link>
                </p>
            </div>
        </div>
    );
}
