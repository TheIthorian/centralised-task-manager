import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.js';
import { ThemeProvider } from './theme/ThemeContext.js';

if (!import.meta.env['VITE_API_URL']) {
    throw new Error('VITE_API_URL is required');
}

const root = document.getElementById('root');

if (!root) throw new Error('Root element not found');

createRoot(root).render(
    <StrictMode>
        <ThemeProvider>
            <App />
        </ThemeProvider>
    </StrictMode>,
);
