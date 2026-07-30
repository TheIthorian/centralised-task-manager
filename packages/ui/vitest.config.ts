import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

// Tailwind is deliberately absent: these tests assert behaviour, never styling, so
// compiling CSS would only slow the run down.
export default defineConfig({
    plugins: [react(), svgr()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test-setup.ts'],
    },
});
