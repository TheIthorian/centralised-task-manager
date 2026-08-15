import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

/**
 * Runs the CLI straight from `src` with no build step.
 *
 * Source files import each other with `.js` specifiers, which is what the compiled output needs
 * but does not exist before `tsc` runs, so the resolve hook points those back at the `.ts` file.
 * Node strips the types itself; `--experimental-transform-types` is required because the codebase
 * uses `enum`, which is not erasable syntax.
 */
export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) {
        const candidate = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);

        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }

    return nextResolve(specifier, context);
}

register(import.meta.url);
