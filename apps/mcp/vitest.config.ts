import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [swc.vite()],
    resolve: {
        alias: {
            // Resolved to source so the app and the package share one module graph. Through the
            // built entry point each gets its own copy of `@ctm/errors`, and then
            // `instanceof ConfigurationError` is false for an error the package itself threw.
            '@ctm/env': resolve(import.meta.dirname, '../../packages/env/src/index.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.spec.ts'],
        setupFiles: ['./vitest.setup.ts'],
    },
});
