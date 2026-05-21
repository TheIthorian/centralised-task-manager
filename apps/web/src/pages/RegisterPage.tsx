import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.js';
import { getErrorMessage } from '../api/error-message.js';
import { Button, Input } from '../components/ui/index.js';

/** Full-page registration form. Auto-logs in on success. */
export function RegisterPage(): React.JSX.Element {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            setError('Passwords do not match.');

            return;
        }

        setLoading(true);

        try {
            await register(name, email, password);
            await navigate('/tasks');
        } catch (error) {
            setError(getErrorMessage(error, 'Registration failed. Email may already be taken.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-nb-yellow flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white border-4 border-nb-black shadow-[6px_6px_0px_#111] p-8">
                <h1 className="text-3xl font-black uppercase tracking-tight text-nb-black mb-6">Create Account</h1>

                {error && (
                    <div className="border-2 border-nb-red bg-nb-red/10 p-3 mb-4">
                        <p className="text-nb-red font-bold text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label="Name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoComplete="name"
                    />
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
                        autoComplete="new-password"
                    />
                    <Input
                        label="Confirm Password"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        autoComplete="new-password"
                    />
                    <Button type="submit" disabled={loading} className="w-full mt-2">
                        {loading ? 'Creating…' : 'Create Account'}
                    </Button>
                </form>

                <p className="mt-4 text-center text-sm font-bold text-nb-black">
                    Have an account?{' '}
                    <Link to="/login" className="underline font-black">
                        Login →
                    </Link>
                </p>
            </div>
        </div>
    );
}
