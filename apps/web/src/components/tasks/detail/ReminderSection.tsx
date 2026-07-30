import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@ctm/ui';
import type { ReminderDto } from '@ctm/api-client';
import { useAuth } from '../../../auth/AuthContext.js';
import { DATE_FIELD_CLASS, DetailSection, FIELD_CONTROL_CLASS, FIELD_HEIGHT_CLASS, FIELD_LABEL_CLASS } from './DetailSection.js';
import type { FieldOwnership } from './field-ownership.js';

type ReminderSectionProps = {
    taskId: string;
    reminders: ReminderDto[];
    ownership: FieldOwnership;
    disabled: boolean;
};

/** The reminders on a task. Each add and remove is its own call, not part of the save. */
export function ReminderSection({
    taskId,
    reminders: initialReminders,
    ownership,
    disabled,
}: ReminderSectionProps): React.JSX.Element {
    const { t, i18n } = useTranslation();
    const { api } = useAuth();
    const fieldId = useId();
    const [reminders, setReminders] = useState<ReminderDto[]>(initialReminders);
    const [remindAt, setRemindAt] = useState('');

    const addMutation = useMutation({
        mutationFn: (value: string) => api.addReminder({ id: taskId, dto: { remindAt: value } }),
        onSuccess: (added: ReminderDto) => {
            setReminders((current) => [...current, added]);
            setRemindAt('');
        },
    });

    const removeMutation = useMutation({
        mutationFn: (index: number) => api.removeReminder({ id: taskId, index }),
        onSuccess: (_data: unknown, index: number) => {
            setReminders((current) => current.filter((_, position) => position !== index));
        },
    });

    const busy = disabled || addMutation.isPending || removeMutation.isPending;

    return (
        <DetailSection title={t('taskDetail.reminders.title')} ownership={ownership}>
            {reminders.length === 0 ? (
                <p className="text-xs text-muted">{t('taskDetail.reminders.empty')}</p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {reminders.map((reminder, index) => {
                        const when = formatReminder({ isoDate: reminder.remindAt, locale: i18n.language });

                        return (
                            <li key={reminder.remindAt} className="flex items-center justify-between gap-3">
                                <span className={reminder.firedAt ? 'text-xs text-muted' : 'text-xs text-fg'}>
                                    {reminder.firedAt ? t('taskDetail.reminders.sent', { when }) : when}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={busy}
                                    aria-label={t('taskDetail.reminders.removeLabel', { when })}
                                    onClick={() => removeMutation.mutate(index)}
                                    className={FIELD_HEIGHT_CLASS}
                                >
                                    {t('taskDetail.reminders.remove')}
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                    <label htmlFor={fieldId} className={FIELD_LABEL_CLASS}>
                        {t('taskDetail.reminders.newLabel')}
                    </label>
                    <input
                        id={fieldId}
                        type="datetime-local"
                        value={remindAt}
                        disabled={busy}
                        onChange={(event) => setRemindAt(event.target.value)}
                        className={`${FIELD_CONTROL_CLASS} ${DATE_FIELD_CLASS}`}
                    />
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={!remindAt || busy}
                    onClick={() => addMutation.mutate(new Date(remindAt).toISOString())}
                    className={FIELD_HEIGHT_CLASS}
                >
                    {t('taskDetail.reminders.add')}
                </Button>
            </div>
        </DetailSection>
    );
}

/** Renders a reminder instant in the reader's locale. */
function formatReminder({ isoDate, locale }: { isoDate: string; locale: string }): string {
    return new Date(isoDate).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
