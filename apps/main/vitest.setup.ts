import { resolve } from 'path';
import mongoose from 'mongoose';

// Load .env.test into process.env so NestJS ConfigModule picks up RSA keys and
// other test-only variables during module compilation.
process.loadEnvFile(resolve(import.meta.dirname, '.env.test'));

beforeAll(async () => {
    try {
        await mongoose.connect(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test', {
            serverSelectionTimeoutMS: 3000,
        });
    } catch {
        // MongoDB not available — integration tests will be skipped or fail individually
    }
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
});
