import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@ctm/ui';
import type { LocationDto } from '@ctm/api-client';
import { DetailSection } from './DetailSection.js';
import type { FieldOwnership } from './field-ownership.js';

type LocationSectionProps = {
    locations: LocationDto[];
    onChange: (locations: LocationDto[]) => void;
    ownership: FieldOwnership;
    disabled: boolean;
};

/** Places attached to a task. These travel with the save rather than writing on their own. */
export function LocationSection({
    locations,
    onChange,
    ownership,
    disabled,
}: LocationSectionProps): React.JSX.Element {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');

    const canAdd = name.trim().length > 0 && url.trim().length > 0 && !disabled;

    return (
        <DetailSection title={t('taskDetail.locations.title')} ownership={ownership}>
            {locations.length === 0 ? (
                <p className="text-xs text-muted">{t('taskDetail.locations.empty')}</p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {locations.map((location, index) => (
                        <li key={location.googleMapsUrl} className="flex items-center gap-2 text-sm">
                            <a
                                href={location.googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 truncate rounded-ctm text-fg underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                                {location.name}
                            </a>
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={disabled}
                                aria-label={t('taskDetail.locations.removeLabel', { name: location.name })}
                                onClick={() => onChange(locations.filter((_, position) => position !== index))}
                                className="min-h-11 md:min-h-0"
                            >
                                {t('taskDetail.locations.remove')}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <div className="flex-1">
                    <Input
                        label={t('taskDetail.locations.nameLabel')}
                        value={name}
                        disabled={disabled}
                        onChange={(event) => setName(event.target.value)}
                        className="min-h-11 md:min-h-0"
                    />
                </div>
                <div className="flex-1">
                    <Input
                        label={t('taskDetail.locations.urlLabel')}
                        type="url"
                        value={url}
                        disabled={disabled}
                        onChange={(event) => setUrl(event.target.value)}
                        className="min-h-11 md:min-h-0"
                    />
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={!canAdd}
                    onClick={() => {
                        onChange([...locations, { name: name.trim(), googleMapsUrl: url.trim() }]);
                        setName('');
                        setUrl('');
                    }}
                    className="min-h-11 md:min-h-0"
                >
                    {t('taskDetail.locations.add')}
                </Button>
            </div>
        </DetailSection>
    );
}
