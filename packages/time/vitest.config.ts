import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        // A non-UTC, non-whole-hour-from-UTC zone, so anything that quietly falls back to the
        // machine's clock produces a wrong answer here rather than a right one by luck.
        env: { TZ: 'Pacific/Chatham' },
    },
});
