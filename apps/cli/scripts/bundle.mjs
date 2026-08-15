import { chmod } from 'node:fs/promises';
import { build } from 'esbuild';

const OUTFILE = 'dist/ctm.cjs';

/**
 * Bundle the CLI into a single runnable file, baking CTM_DEFAULT_BASE_URL in as the last-resort
 * API base URL. Leaving the variable unset produces a bundle with no default, which is what a
 * local build wants.
 */
async function main() {
    const define = {};
    const defaultBaseUrl = process.env['CTM_DEFAULT_BASE_URL'];

    if (defaultBaseUrl) {
        // A malformed URL would otherwise only surface as a confusing fetch failure in the
        // downloaded binary, long after the build that introduced it.
        new URL(defaultBaseUrl);
        define['__CTM_DEFAULT_BASE_URL__'] = JSON.stringify(defaultBaseUrl);
    }

    await build({
        entryPoints: ['src/main.ts'],
        outfile: OUTFILE,
        bundle: true,
        platform: 'node',
        // CJS: several transitive deps (mute-stream and friends) call require() at load time, which
        // an ESM bundle cannot satisfy.
        format: 'cjs',
        target: 'node24',
        sourcemap: false,
        define,
    });

    // esbuild hoists the entry point's own shebang, so the bundle only needs the exec bit.
    await chmod(OUTFILE, 0o755);

    console.log(`Bundled ${OUTFILE}${defaultBaseUrl ? ` (default base URL: ${defaultBaseUrl})` : ' (no default base URL)'}`);
}

await main();
