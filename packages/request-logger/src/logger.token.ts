/**
 * DI token for the application's root logger. Each app validates its own environment and provides
 * the logger under this token; nothing in this package builds one, because nothing in this package
 * knows where the configuration comes from.
 */
export const APP_LOGGER = Symbol.for('ctm:app-logger');
