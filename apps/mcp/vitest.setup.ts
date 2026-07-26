import { resolve } from 'path';

// ConfigModule validates at import time, so the env must be loaded before any
// spec pulls in AppModule. Without this it falls back to the developer's local
// .env, which CI does not have.
process.loadEnvFile(resolve(import.meta.dirname, '.env.test'));
