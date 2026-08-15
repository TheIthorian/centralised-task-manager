import type en from './en.json';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'app';
        resources: { app: typeof en };
    }
}
