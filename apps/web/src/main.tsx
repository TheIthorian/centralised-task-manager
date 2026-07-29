import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.js';
import { initI18n } from './i18n/index.js';
import { DensityProvider } from './theme/DensityContext.js';
import { ThemeProvider } from './theme/ThemeContext.js';

const root = document.getElementById('root');

if (!root) throw new Error('Root element not found');

// The catalogue is loaded before the first render, so no screen ever flashes key paths.
await initI18n();

createRoot(root).render(
    <StrictMode>
        <ThemeProvider>
            <DensityProvider>
                <App />
            </DensityProvider>
        </ThemeProvider>
    </StrictMode>,
);
