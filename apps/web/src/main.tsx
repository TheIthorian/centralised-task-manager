import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initClient } from '@ctm/api-client';
import './index.css';
import App from './App.js';

initClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000');

const root = document.getElementById('root');

if (!root) throw new Error('Root element not found');

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
