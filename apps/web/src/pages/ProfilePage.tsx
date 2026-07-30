import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { UpdateUserDto } from '@ctm/api-client';
import { getErrorMessage } from '../api/error-message.js';
import { useAuth } from '../auth/AuthContext.js';
import { Button, Input } from '@ctm/ui';
import { DataSection } from '../components/settings/DataSection.js';
import { AppearanceSection } from '../components/settings/AppearanceSection.js';

/** Settings sub-page: user profile, password change, and account deletion. */
export function ProfilePage(): React.JSX.Element {
    const { user, logout, updateUser, api } = useAuth();

    // ── Update email / password form ──────────────────────────────────────
    const [email, setEmail] = useState(user?.email ?? '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);

    const saveMutation = useMutation({
        mutationFn: (dto: UpdateUserDto) => api.updateMe({ dto }),
        onSuccess: (nextUser) => {
            updateUser(nextUser);
            setSaveSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setTimeout(() => setSaveSuccess(false), 3000);
        },
    });

    const handleSave = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        const dto: UpdateUserDto = { email };
        if (currentPassword) {
            dto.currentPassword = currentPassword;
            dto.newPassword = newPassword;
        }
        await saveMutation.mutateAsync(dto);
    };

    // ── Delete account ────────────────────────────────────────────────────
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');

    const deleteMutation = useMutation({
        mutationFn: () => api.deleteMe(),
        onSuccess: () => {
            void logout();
        },
    });

    const handleDeleteClick = (): void => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async (): Promise<void> => {
        await deleteMutation.mutateAsync();
    };

    const busy = saveMutation.isPending || deleteMutation.isPending;
    const canConfirmDelete = deleteConfirmEmail === user?.email;

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight text-fg">Profile</h1>
                <p className="text-muted font-medium text-sm mt-1">
                    Update your account details.
                </p>
            </div>

            <div className="mb-8 rounded-ctm border border-line bg-panel p-5">
                <AppearanceSection />
            </div>

            {/* Update form */}
            <form
                onSubmit={handleSave}
                className="bg-panel border border-line p-5 flex flex-col gap-4 mb-8 rounded-ctm"
            >
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

                <div>
                    <p className="font-semibold text-xs tracking-wide text-fg mb-2">
                        Change Password
                    </p>
                    <div className="flex flex-col gap-3">
                        <Input
                            label="Current Password"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Current password"
                        />
                        <Input
                            label="New Password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New password"
                            disabled={!currentPassword}
                        />
                    </div>
                </div>

                {saveMutation.isError && (
                    <p className="text-warn font-medium text-sm">
                        {getErrorMessage(saveMutation.error, 'Failed to save changes. Please try again.')}
                    </p>
                )}

                {saveSuccess && <p className="text-accent font-medium text-sm">Changes saved!</p>}

                <div>
                    <Button type="submit" disabled={busy}>
                        {saveMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </form>

            {/* Data export / import */}
            <DataSection />

            {/* Danger zone */}
            <div className="border border-warn p-5 rounded-ctm">
                <h2 className="font-semibold text-warn text-sm tracking-wide mb-3">Danger Zone</h2>

                {!showDeleteConfirm && (
                    <Button variant="danger" onClick={handleDeleteClick} disabled={busy}>
                        Delete Account
                    </Button>
                )}

                {showDeleteConfirm && (
                    <div className="flex flex-col gap-3">
                        <p className="font-medium text-sm text-fg">
                            This will permanently delete your account and all your data. Type your email to confirm.
                        </p>
                        <Input
                            label="Confirm Email"
                            type="email"
                            value={deleteConfirmEmail}
                            onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                            placeholder="Type your email to confirm"
                        />

                        {deleteMutation.isError && (
                            <p className="text-warn font-medium text-sm">
                                {getErrorMessage(deleteMutation.error, 'Failed to delete account. Please try again.')}
                            </p>
                        )}

                        <div className="flex gap-2">
                            <Button variant="danger" onClick={handleConfirmDelete} disabled={!canConfirmDelete || busy}>
                                {deleteMutation.isPending ? 'Deleting…' : 'Confirm Delete'}
                            </Button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteConfirmEmail('');
                                }}
                                className="font-semibold text-xs text-fg underline"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
