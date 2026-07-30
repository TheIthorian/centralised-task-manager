import type { Preview } from '@storybook/react-vite';
import './preview.css';

const preview: Preview = {
    globalTypes: {
        theme: {
            description: 'Quiet Slate ships two themes; every story is reviewed in both.',
            toolbar: {
                title: 'Theme',
                items: [
                    { value: 'light', title: 'Light' },
                    { value: 'dark', title: 'Dark' },
                ],
                dynamicTitle: true,
            },
        },
        density: {
            description: 'Row density, the same three values the app offers.',
            toolbar: {
                title: 'Density',
                items: [
                    { value: 'compact', title: 'Compact' },
                    { value: 'comfortable', title: 'Comfortable' },
                    { value: 'spacious', title: 'Spacious' },
                ],
                dynamicTitle: true,
            },
        },
    },
    initialGlobals: { theme: 'light', density: 'comfortable' },
    decorators: [
        (Story, context) => {
            const root = document.documentElement;

            root.classList.toggle('dark', context.globals['theme'] === 'dark');
            root.dataset['density'] = String(context.globals['density'] ?? 'comfortable');

            return Story();
        },
    ],
};

export default preview;
