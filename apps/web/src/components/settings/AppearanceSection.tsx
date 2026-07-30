import { useTranslation } from 'react-i18next';
import { DensityPreview, SegmentedControl } from '@ctm/ui';
import { useDensity } from '../../theme/DensityContext.js';
import type { Density } from '../../theme/DensityContext.js';
import { useTheme } from '../../theme/ThemeContext.js';

type ThemeValue = 'light' | 'dark';

/** Display preferences: theme and row density, with a live preview of what density does. */
export function AppearanceSection(): React.JSX.Element {
    const { t } = useTranslation();
    const { theme, toggle } = useTheme();
    const { density, setDensity } = useDensity();

    const sampleRows = [
        { title: t('settings.appearance.sample.first'), meta: t('settings.appearance.sample.firstMeta') },
        { title: t('settings.appearance.sample.second'), meta: t('settings.appearance.sample.secondMeta') },
        { title: t('settings.appearance.sample.third'), meta: t('settings.appearance.sample.thirdMeta') },
    ];

    return (
        <section className="flex flex-col gap-5">
            <h2 className="text-sm font-semibold text-fg">{t('settings.appearance.title')}</h2>

            <div className="flex flex-col items-start gap-2">
                <SegmentedControl<ThemeValue>
                    label={t('settings.appearance.theme')}
                    value={theme}
                    // The theme context only exposes a toggle, so a same-value click is a no-op.
                    onChange={(next) => {
                        if (next !== theme) toggle();
                    }}
                    options={[
                        { value: 'light', label: t('settings.appearance.light') },
                        { value: 'dark', label: t('settings.appearance.dark') },
                    ]}
                />
            </div>

            <div className="flex flex-col items-start gap-2">
                <SegmentedControl<Density>
                    label={t('settings.appearance.density')}
                    value={density}
                    onChange={setDensity}
                    options={[
                        { value: 'compact', label: t('settings.appearance.compact') },
                        { value: 'comfortable', label: t('settings.appearance.comfortable') },
                        { value: 'spacious', label: t('settings.appearance.spacious') },
                    ]}
                />
                <p className="max-w-[52ch] text-xs text-muted">{t('settings.appearance.densityHelp')}</p>
                <DensityPreview rows={sampleRows} />
            </div>
        </section>
    );
}
