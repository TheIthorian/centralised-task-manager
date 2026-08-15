import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@ctm/ui';

/** Reached when an address is not one of the three console sections. */
export function NotFoundPage(): React.JSX.Element {
    const { t } = useTranslation();

    return (
        <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
            <EmptyState
                title={t('notFound.title')}
                body={t('notFound.body')}
                action={
                    <Link
                        to="/dashboard"
                        className="mt-2 text-[13px] text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        {t('notFound.action')}
                    </Link>
                }
            />
        </div>
    );
}
