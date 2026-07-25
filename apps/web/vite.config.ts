import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    const apiOrigin = env['API_ORIGIN'];

    if (!apiOrigin) {
        throw new Error('API_ORIGIN is not set. Copy apps/web/.env.example to apps/web/.env.');
    }

    return {
        plugins: [react(), tailwindcss()],
        server: {
            host: '0.0.0.0',
            port: 5173,
            proxy: {
                '/api': {
                    target: apiOrigin,
                    changeOrigin: true,
                    ws: true,
                    rewrite: (path: string): string => path.replace(/^\/api/, ''),
                    headers: { 'X-Ctm-Client': 'web' },
                },
            },
        },
    };
});
