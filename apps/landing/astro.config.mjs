import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
    integrations: [react()],
    vite: {
        // @ctm/ui imports brand marks as `?react` components, so the landing build needs the
        // same svgr transform as apps/web.
        plugins: [tailwindcss(), svgr()],
    },
    output: 'static',
});
