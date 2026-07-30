import { useTranslation } from 'react-i18next';
import type { FuzzyDeadlineInfo } from '@ctm/api-client';
import { DetailSection } from './DetailSection.js';
import { DetailSelect } from './DetailSelect.js';
import type { FieldOwnership } from './field-ownership.js';

export type FuzzyType = FuzzyDeadlineInfo['type'];

/** The reminder cadence, with `none` standing in for an absent one so the select has a value. */
export type FuzzyCadence = 'daily' | 'weekly' | 'none';

const FUZZY_TYPES: FuzzyType[] = ['this_week', 'this_month', 'someday'];

const FUZZY_CADENCES: FuzzyCadence[] = ['none', 'daily', 'weekly'];

type FuzzyDeadlineSectionProps = {
    current: FuzzyDeadlineInfo | null;
    type: FuzzyType;
    cadence: FuzzyCadence;
    onTypeChange: (type: FuzzyType) => void;
    onCadenceChange: (cadence: FuzzyCadence) => void;
    ownership: FieldOwnership;
    disabled: boolean;
};

/** A horizon for a task that is due sometime rather than at a time, and how often to nudge. */
export function FuzzyDeadlineSection({
    current,
    type,
    cadence,
    onTypeChange,
    onCadenceChange,
    ownership,
    disabled,
}: FuzzyDeadlineSectionProps): React.JSX.Element {
    const { t } = useTranslation();

    return (
        <DetailSection title={t('taskDetail.fuzzy.title')} ownership={ownership}>
            {current && (
                <p className="text-xs text-muted">
                    {current.remindEvery
                        ? t('taskDetail.fuzzy.currentWithReminder', {
                              horizon: t(`taskDetail.fuzzy.types.${current.type}`),
                              cadence: t(`taskDetail.fuzzy.cadences.${current.remindEvery}`),
                          })
                        : t('taskDetail.fuzzy.current', {
                              horizon: t(`taskDetail.fuzzy.types.${current.type}`),
                          })}
                </p>
            )}

            <div className="flex flex-col gap-2 md:flex-row">
                <div className="flex-1">
                    <DetailSelect
                        label={t('taskDetail.fuzzy.typeLabel')}
                        value={type}
                        disabled={disabled}
                        onChange={onTypeChange}
                        options={FUZZY_TYPES.map((value) => ({
                            value,
                            label: t(`taskDetail.fuzzy.types.${value}`),
                        }))}
                    />
                </div>
                <div className="flex-1">
                    <DetailSelect
                        label={t('taskDetail.fuzzy.cadenceLabel')}
                        value={cadence}
                        disabled={disabled}
                        onChange={onCadenceChange}
                        options={FUZZY_CADENCES.map((value) => ({
                            value,
                            label: t(`taskDetail.fuzzy.cadences.${value}`),
                        }))}
                    />
                </div>
            </div>
        </DetailSection>
    );
}
