import { resolve } from 'path';
import { generateKeyPairSync } from 'crypto';
import mongoose from 'mongoose';

process.loadEnvFile(resolve(import.meta.dirname, '.env.test'));

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

process.env['RSA_PRIVATE_KEY'] = Buffer.from(privateKey).toString('base64');
process.env['RSA_PUBLIC_KEY'] = Buffer.from(publicKey).toString('base64');

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
