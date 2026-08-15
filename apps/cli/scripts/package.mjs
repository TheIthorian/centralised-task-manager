import { createRequire } from 'node:module';
import { cp, mkdir, rm, chmod, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// The native bindings are optional dependencies of the keyring package, not of this one, so they
// resolve from there rather than from this script.
const keyringRequire = createRequire(require.resolve('@napi-rs/keyring'));
const OUT_DIR = 'release';

/**
 * Lay out the release directory: the bundle, plus the keyring package and the one native binding
 * this platform needs.
 *
 * The binding is a `.node` file, which esbuild cannot inline, so `ctm` is no longer a lone file:
 * it resolves `@napi-rs/keyring` from the `node_modules` directory beside it. That also makes each
 * release artifact platform-specific.
 */
async function main() {
    await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(join(OUT_DIR, 'node_modules', '@napi-rs'), { recursive: true });

    await cp('dist/ctm.cjs', join(OUT_DIR, 'ctm'));
    await chmod(join(OUT_DIR, 'ctm'), 0o755);

    // `ctm` has no extension, so Node reads the nearest package.json to decide the module system.
    // Without this it inherits whatever directory it was extracted into and an ESM parent breaks
    // the CommonJS bundle.
    await writeFile(join(OUT_DIR, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);

    for (const name of ['@napi-rs/keyring', nativeBindingPackage()]) {
        // Dereferenced: pnpm's node_modules entries are symlinks into the store, which a tarball
        // extracted on another machine could not follow.
        await cp(packageRoot(name), join(OUT_DIR, 'node_modules', name), { recursive: true, dereference: true });
    }

    console.log(`Packaged ${OUT_DIR}/ for ${process.platform}-${process.arch}`);
}

/** The `@napi-rs/keyring-*` optional dependency installed for this platform. */
function nativeBindingPackage() {
    const { optionalDependencies } = require('@napi-rs/keyring/package.json');
    const installed = Object.keys(optionalDependencies ?? {}).find((name) => {
        try {
            keyringRequire.resolve(`${name}/package.json`);

            return true;
        } catch {
            return false;
        }
    });

    if (!installed) {
        throw new Error(`No @napi-rs/keyring native binding installed for ${process.platform}-${process.arch}`);
    }

    return installed;
}

function packageRoot(name) {
    return dirname(keyringRequire.resolve(`${name}/package.json`));
}

await main();
