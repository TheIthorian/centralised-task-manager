import { createEnvLoader } from '@ctm/env';
import { envSchema } from './env.schema.js';

export const { loadEnv, toLoggerConfig, resetEnvCache } = createEnvLoader({ schema: envSchema });
