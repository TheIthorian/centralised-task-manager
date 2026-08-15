/**
 * CJS register hook for ts-node dev mode.
 * Patches Module._resolveFilename to remap .js → .ts imports so that
 * NodeNext-style .js-suffixed imports work at runtime without ESM mode.
 */
const Module = require('module');

const original = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request.endsWith('.js')) {
        try {
            return original(request.slice(0, -3) + '.ts', parent, isMain, options);
        } catch {
            // fall through to original (.js might be a real JS file)
        }
    }
    return original(request, parent, isMain, options);
};

require('ts-node').register({ swc: true });
