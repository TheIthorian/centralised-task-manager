import 'reflect-metadata';
import { createApp } from './bootstrap.js';

async function bootstrap(): Promise<void> {
    const app = await createApp();
    const port = process.env['PORT'] ?? 3000;
    await app.listen(port, '0.0.0.0');
}

void bootstrap();
