import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
    plugins: [react(), tailwindcss(), svgr()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test-setup.ts'],
        // A non-UTC, non-whole-hour zone, so a date assertion that quietly relies on the machine
        // clock fails here rather than passing by luck on a UTC CI runner.
        env: { TZ: 'Pacific/Chatham' },
    },
});
