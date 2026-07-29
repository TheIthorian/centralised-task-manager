import type { StorybookConfig } from '@storybook/react-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';

// Stories live beside their component in packages/ui, so a component and its examples
// change in the same commit. This app is only the harness.
const config: StorybookConfig = {
    stories: ['../../../packages/ui/src/**/*.stories.tsx'],
    framework: { name: '@storybook/react-vite', options: {} },
    viteFinal: (viteConfig) => ({
        ...viteConfig,
        plugins: [...(viteConfig.plugins ?? []), react(), tailwindcss(), svgr()],
    }),
};

export default config;
