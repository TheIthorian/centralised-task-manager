import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json' with { type: 'json' };

/**
 * English only for now. `fallbackLng` is off on purpose: a missing key should be a visible
 * bug during development rather than a key path rendered as if it were copy.
 */
export async function initI18n(): Promise<void> {
    if (i18next.isInitialized) return;

    await i18next.use(initReactI18next).init({
        lng: 'en',
        fallbackLng: false,
        defaultNS: 'app',
        ns: ['app'],
        resources: { en: { app: en } },
        interpolation: { escapeValue: false },
    });
}
