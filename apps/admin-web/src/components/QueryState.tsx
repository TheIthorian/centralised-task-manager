import { useTranslation } from 'react-i18next';
import { Banner, Button, Skeleton } from '@ctm/ui';
import { getErrorMessage } from '../api/error-message.js';

/**
 * The two states every read has before it has data. A failed read is a banner rather than a
 * toast: it stays on screen next to the thing that is missing, with the retry beside it.
 */
export function QueryState({
    isPending,
    error,
    title,
    onRetry,
    rows = 4,
}: {
    isPending: boolean;
    error: unknown;
    title: string;
    onRetry: () => void;
    rows?: number;
}): React.JSX.Element | null {
    const { t } = useTranslation();

    if (error) {
        return (
            <Banner
                tone="warn"
                title={title}
                body={getErrorMessage(error, t('common.unknownError'))}
                action={
                    <Button variant="secondary" onClick={onRetry} className="mt-2 self-start text-xs">
                        {t('common.retry')}
                    </Button>
                }
            />
        );
    }

    if (isPending) {
        return (
            <div role="status" aria-live="polite" aria-label={t('common.loading')}>
                <Skeleton rows={rows} />
            </div>
        );
    }

    return null;
}
