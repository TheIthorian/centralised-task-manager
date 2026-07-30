import '@testing-library/jest-dom';
import { initI18n } from './i18n/index.js';

// Tests query by visible text, so they need the real catalogue rather than key paths.
await initI18n();
