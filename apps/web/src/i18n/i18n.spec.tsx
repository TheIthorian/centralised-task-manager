import { render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { describe, expect, it } from 'vitest';

function Probe(): React.JSX.Element {
    const { t } = useTranslation();

    return (
        <>
            <span>{t('tasks.title')}</span>
            <span>{t('tasks.shownCount', { count: 6 })}</span>
            <span>{t('tasks.openCount', { count: 14 })}</span>
        </>
    );
}

describe('translations', () => {
    it('resolves keys and interpolates counts', () => {
        render(<Probe />);

        expect(screen.getByText('Tasks')).toBeInTheDocument();
        expect(screen.getByText('6 shown')).toBeInTheDocument();
        expect(screen.getByText('14 open')).toBeInTheDocument();
    });
});
