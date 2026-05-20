import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
    title: 'CTM API Docs',
    tagline: 'Centralised Task Manager — API Reference & Guides',
    url: 'http://localhost:3001',
    baseUrl: '/',
    onBrokenLinks: 'warn',
    organizationName: 'ctm',
    markdown: {
        hooks: {
            onBrokenMarkdownLinks: 'warn',
        },
    },
    projectName: 'ctm',

    presets: [
        [
            'classic',
            {
                docs: {
                    sidebarPath: './sidebars.ts',
                    routeBasePath: '/',
                    docItemComponent: '@theme/ApiItem',
                },
                blog: false,
                theme: {
                    customCss: './src/css/custom.css',
                },
            } satisfies Preset.Options,
        ],
    ],

    plugins: [
        // Suppress Node.js built-in polyfill warnings from postman-code-generators
        function nodeBuiltinFallback() {
            return {
                name: 'node-builtin-fallback',
                configureWebpack() {
                    return {
                        resolve: {
                            fallback: {
                                path: false,
                                fs: false,
                                os: false,
                                crypto: false,
                                stream: false,
                                buffer: false,
                            },
                        },
                    };
                },
            };
        },
        [
            'docusaurus-plugin-openapi-docs',
            {
                id: 'openapi',
                docsPluginId: 'classic',
                config: {
                    ctm: {
                        specPath: '../main/openapi.json',
                        outputDir: 'docs/api',
                        sidebarOptions: {
                            groupPathsBy: 'tag',
                            categoryLinkSource: 'tag',
                        },
                        showSchemas: true,
                    },
                },
            },
        ],
    ],

    themes: ['docusaurus-theme-openapi-docs'],

    themeConfig: {
        navbar: {
            title: 'CTM Docs',
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'guideSidebar',
                    label: 'Guides',
                    position: 'left',
                },
                {
                    type: 'docSidebar',
                    sidebarId: 'apiSidebar',
                    label: 'API Reference',
                    position: 'left',
                },
            ],
        },
        footer: {
            style: 'dark',
            copyright: `Copyright © ${new Date().getFullYear()} CTM`,
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
