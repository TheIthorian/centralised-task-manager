// The logging variables are required with no defaults, so a suite that builds a real logger has
// to supply them the same way a deployment does. `config.spec.ts` passes its own env object and
// is unaffected by these.
process.env['LOG_LEVEL'] = 'error';
process.env['LOG_PRETTY'] = 'false';
process.env['LOG_REDACT'] = 'true';
