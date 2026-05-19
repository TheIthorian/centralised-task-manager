import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export function createNodeConfig(options = {}) {
    const {
        ignores = ['dist', 'pnpm-lock.yaml'],
        files = ['**/*.{ts,tsx}'],
        extraRules = {},
        tsconfigRootDir,
    } = options;

    return tseslint.config(
        { ignores },
        {
            extends: [js.configs.recommended, ...tseslint.configs.recommended],
            files,
            languageOptions: {
                ecmaVersion: 2022,
                globals: globals.node,
                parserOptions: { tsconfigRootDir },
            },
            rules: {
                '@typescript-eslint/no-unused-vars': 'off',
                '@typescript-eslint/explicit-function-return-type': 'error',
                ...extraRules,
            },
        },
    );
}
