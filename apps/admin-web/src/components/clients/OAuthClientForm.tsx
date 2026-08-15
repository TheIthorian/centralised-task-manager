import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Checkbox, Input } from '@ctm/ui';
import type { AdminOAuthClientDto, AvailableScopeDto } from '@ctm/api-client';
import { toLines } from '../../lib/format.js';

/** What the form collects. Turning it into a create or an update payload is the caller's job. */
export type OAuthClientFormValues = {
    clientName: string;
    redirectUris: string[];
    scopes: string[];
    clientUri: string;
    contacts: string[];
};

type OAuthClientFormProps = {
    client: AdminOAuthClientDto | null;
    availableScopes: AvailableScopeDto[];
    submitLabel: string;
    isPending: boolean;
    submitError: string | null;
    onSubmit: (values: OAuthClientFormValues) => void;
    onCancel: () => void;
};

/** Register or reconfigure a client. Used for both, because the fields are the same. */
export function OAuthClientForm({
    client,
    availableScopes,
    submitLabel,
    isPending,
    submitError,
    onSubmit,
    onCancel,
}: OAuthClientFormProps): React.JSX.Element {
    const { t } = useTranslation();

    const requiredScopes = availableScopes.filter((entry) => entry.required).map((entry) => entry.scope);

    const [clientName, setClientName] = useState(client?.clientName ?? '');
    const [redirectUris, setRedirectUris] = useState((client?.redirectUris ?? []).join('\n'));
    const [clientUri, setClientUri] = useState(client?.clientUri ?? '');
    const [contacts, setContacts] = useState((client?.contacts ?? []).join('\n'));
    const [scopes, setScopes] = useState<string[]>(client?.scopes ?? requiredScopes);
    const [validationError, setValidationError] = useState<string | null>(null);

    const toggleScope = (scope: string): void => {
        setScopes((current) =>
            current.includes(scope) ? current.filter((entry) => entry !== scope) : [...current, scope],
        );
    };

    const handleSubmit = (event: React.FormEvent): void => {
        event.preventDefault();

        const uris = toLines(redirectUris);
        const problem = validate({ clientName, uris, scopes, t });

        setValidationError(problem);

        if (problem !== null) return;

        onSubmit({
            clientName: clientName.trim(),
            redirectUris: uris,
            scopes,
            clientUri: clientUri.trim(),
            contacts: toLines(contacts),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {(validationError ?? submitError) && (
                <Banner
                    tone="warn"
                    title={t('clients.form.saveFailed')}
                    body={validationError ?? submitError ?? ''}
                />
            )}

            <Input
                label={t('clients.form.clientName')}
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                maxLength={200}
                required
            />

            <TextAreaField
                id="redirect-uris"
                label={t('clients.form.redirectUris')}
                hint={t('clients.form.redirectUrisHint')}
                value={redirectUris}
                onChange={setRedirectUris}
                rows={3}
            />

            <fieldset className="flex flex-col gap-2">
                <legend className="text-[11px] uppercase tracking-[0.12em] text-muted">
                    {t('clients.form.scopes')}
                </legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                    {availableScopes.map((entry) => (
                        <span key={entry.scope} className="flex items-center gap-2">
                            <Checkbox
                                label={entry.label}
                                checked={scopes.includes(entry.scope)}
                                // A required scope is part of the protocol, not a choice: openid
                                // is what makes the id token meaningful.
                                disabled={entry.required}
                                onChange={() => toggleScope(entry.scope)}
                            />
                            <span className="text-[13px] text-fg">{entry.label}</span>
                            <code className="truncate text-[11px] text-muted">{entry.scope}</code>
                        </span>
                    ))}
                </div>
            </fieldset>

            <Input
                label={t('clients.form.clientUri')}
                type="url"
                value={clientUri}
                onChange={(event) => setClientUri(event.target.value)}
                maxLength={2000}
            />

            <TextAreaField
                id="contacts"
                label={t('clients.form.contacts')}
                hint={t('clients.form.contactsHint')}
                value={contacts}
                onChange={setContacts}
                rows={2}
            />

            <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isPending} aria-disabled={isPending}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}

function validate({
    clientName,
    uris,
    scopes,
    t,
}: {
    clientName: string;
    uris: string[];
    scopes: string[];
    t: TFunction;
}): string | null {
    if (clientName.trim().length === 0) return t('clients.form.nameRequired');

    if (uris.length === 0) return t('clients.form.redirectUriRequired');

    for (const uri of uris) {
        if (!URL.canParse(uri)) return t('clients.form.redirectUriInvalid', { uri });
    }

    if (scopes.length === 0) return t('clients.form.scopeRequired');

    return null;
}

/**
 * The hint sits outside the `<label>` and is attached with `aria-describedby`: inside it, the
 * accessible name becomes the label and the hint run together.
 */
function TextAreaField({
    id,
    label,
    hint,
    value,
    onChange,
    rows,
}: {
    id: string;
    label: string;
    hint: string;
    value: string;
    onChange: (value: string) => void;
    rows: number;
}): React.JSX.Element {
    const hintId = `${id}-hint`;

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-[11px] uppercase tracking-[0.12em] text-muted">
                {label}
            </label>
            <textarea
                id={id}
                value={value}
                rows={rows}
                aria-describedby={hintId}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-ctm border border-line bg-panel px-3 py-2 font-mono text-[13px] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <span id={hintId} className="text-[11px] text-muted">
                {hint}
            </span>
        </div>
    );
}
