// ts-patch calls program transformers as (program, config); @nestjs/swagger's plugin expects
// (options, program). Thin adapter so the official plugin can run under `tspc`.
const { before } = require('@nestjs/swagger/plugin');

module.exports = (program, config) => before(config?.options ?? {}, program);
