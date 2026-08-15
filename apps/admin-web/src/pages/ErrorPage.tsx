import { useRouteError } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Banner, Button } from '@ctm/ui';
import { getErrorMessage } from '../api/error-message.js';

/** Router error boundary: a render failure inside the shell lands here instead of a blank page. */
export function ErrorPage(): React.JSX.Element {
    const { t } = useTranslation();
    const error = useRouteError();

    return (
        <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
            <Banner
                tone="warn"
                title={t('error.title')}
                body={getErrorMessage(error, t('error.body'))}
                action={
                    <Button variant="secondary" onClick={() => window.location.reload()} className="mt-2 self-start">
                        {t('error.reload')}
                    </Button>
                }
            />
        </div>
    );
}
