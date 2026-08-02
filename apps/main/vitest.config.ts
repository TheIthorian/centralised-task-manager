import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [swc.vite()],
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.spec.ts'],
        setupFiles: ['./vitest.setup.ts'],
        envFile: '.env.test',
        // A non-UTC, non-whole-hour zone, so anything that still reads the server's clock for a
        // day boundary fails here rather than passing by luck on a UTC runner.
        env: { TZ: 'Pacific/Chatham' },
    },
});
