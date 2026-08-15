import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // The schemas are decorated classes, so the specs need the same emitDecoratorMetadata
    // transform the Nest apps use rather than vitest's default stripping.
    plugins: [swc.vite()],
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.spec.ts'],
        setupFiles: ['./vitest.setup.ts'],
        envFile: '.env.test',
    },
});
