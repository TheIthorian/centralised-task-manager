import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // The decorators and DI metadata these helpers rely on need the same transform the Nest apps
    // use rather than vitest's default stripping.
    plugins: [swc.vite()],
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.spec.ts'],
    },
});
