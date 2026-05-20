import mongoose from 'mongoose';

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
