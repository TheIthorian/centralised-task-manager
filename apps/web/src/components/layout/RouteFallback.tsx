import { useTranslation } from 'react-i18next';

/** Placeholder shown while a route's chunk is still downloading. */
export function RouteFallback(): React.JSX.Element {
    const { t } = useTranslation();

    return (
        <div role="status" aria-live="polite" className="flex min-h-dvh items-center justify-center text-muted">
            {t('common.loading')}
        </div>
    );
}
