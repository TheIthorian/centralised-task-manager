import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { createApp } from './bootstrap.js';

async function bootstrap(): Promise<void> {
    const app = await createApp();
    const port = app.get(ConfigService).getOrThrow<number>('PORT');
    // Bind dual-stack: Railway's private network is IPv6-only, so '0.0.0.0' would
    // make the service unreachable from sibling services.
    await app.listen(port, '::');
}

void bootstrap();
