// Measure import + Nest DI cost for an app's bootstrap module.
// Usage: node boot-time.cjs <abs-path-to-dist/bootstrap.js>
const { createRequire } = require('module');

const entry = process.argv[2];
const appRequire = createRequire(entry);
appRequire('reflect-metadata');

const t0 = process.hrtime.bigint();
const mod = appRequire(entry);
const tImport = process.hrtime.bigint();

(async () => {
    const app = await mod.createApp();
    await app.init();
    const tInit = process.hrtime.bigint();
    const ms = (a, b) => +(Number(b - a) / 1e6).toFixed(1);

    console.log('RESULT ' + JSON.stringify({
        importMs: ms(t0, tImport),
        createAppMs: ms(tImport, tInit),
        totalMs: ms(t0, tInit),
        processUptimeMs: +(process.uptime() * 1000).toFixed(1),
        rssMb: +(process.memoryUsage().rss / 1048576).toFixed(1),
    }));

    await app.close();
    process.exit(0);
})();
