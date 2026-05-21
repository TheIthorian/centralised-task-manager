const Module = require('module');

const original = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request.endsWith('.js')) {
        try {
            return original(request.slice(0, -3) + '.ts', parent, isMain, options);
        } catch {
            // fall through
        }
    }
    return original(request, parent, isMain, options);
};

require('ts-node').register({ swc: true });
