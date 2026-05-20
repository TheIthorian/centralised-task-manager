import mongoose from 'mongoose';

beforeAll(async () => {
    await mongoose.connect(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test');
});

afterAll(async () => {
    await mongoose.disconnect();
});
