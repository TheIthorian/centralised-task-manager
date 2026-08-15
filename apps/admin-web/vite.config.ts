import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, __dirname, '');
    const adminApiOrigin = env['ADMIN_API_ORIGIN'];

    // Only the dev proxy needs this. In production the Pages Function reads
    // ADMIN_API_ORIGIN at request time from wrangler.toml, so requiring it at build
    // time would break CI for no gain.
    if (command === 'serve' && !adminApiOrigin) {
        throw new Error('ADMIN_API_ORIGIN is not set. Copy apps/admin-web/.env.example to apps/admin-web/.env.');
    }

    return {
        plugins: [react(), tailwindcss(), svgr()],
        server: {
            host: '0.0.0.0',
            // Not 5173: apps/web holds that, and both run under `pnpm dev`.
            port: 5174,
            proxy: {
                '/api': {
                    target: adminApiOrigin,
                    changeOrigin: true,
                    rewrite: (path: string): string => path.replace(/^\/api(?=\/|$)/, '') || '/',
                },
            },
        },
    };
});
