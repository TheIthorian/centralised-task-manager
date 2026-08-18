// Usage: node require-prof.cjs <absolute-entry.js>
const Module = require('module');
const orig = Module._load;
const self = new Map();
const files = new Map();
const stack = [];
let count = 0;

function pkgOf(file) {
    if (typeof file !== 'string') return '<builtin>';
    const i = file.lastIndexOf('node_modules/');
    if (i === -1) return '<app>';
    const rest = file.slice(i + 13).split('/');
    return rest[0].startsWith('@') ? rest.slice(0, 2).join('/') : rest[0];
}

Module._load = function (request, parent, isMain) {
    let file;
    try { file = Module._resolveFilename(request, parent, isMain); } catch { file = request; }
    const start = process.hrtime.bigint();
    const frame = { file, childTotal: 0n };
    stack.push(frame);
    try {
        count++;
        return orig.apply(this, arguments);
    } finally {
        const total = process.hrtime.bigint() - start;
        stack.pop();
        if (stack.length) stack[stack.length - 1].childTotal += total;
        const selfTime = Number(total - frame.childTotal) / 1e6;
        const key = pkgOf(file);
        self.set(key, (self.get(key) || 0) + selfTime);
        files.set(file, (files.get(file) || 0) + selfTime);
    }
};

const entry = process.argv[2];
const t0 = process.hrtime.bigint();
require(entry);
const totalMs = Number(process.hrtime.bigint() - t0) / 1e6;
Module._load = orig;

const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, v]) => `${v.toFixed(1)}ms  ${k.replace(/^.*node_modules\//, '')}`);

console.log(JSON.stringify({
    entry: entry.replace(/^.*centralised-task-manager\//, ''),
    totalMs: +totalMs.toFixed(1),
    loadCalls: count,
    cachedModules: Object.keys(require.cache).length,
    rssMb: +(process.memoryUsage().rss / 1048576).toFixed(1),
    topPackages: top(self, 20),
    topFiles: top(files, 10),
}, null, 2));
