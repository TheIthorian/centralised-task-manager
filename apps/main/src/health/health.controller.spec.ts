import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Connection } from 'mongoose';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
    let module: TestingModule;
    let controller: HealthController;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [MongooseModule.forRoot(process.env['MONGODB_URI'] as string)],
            controllers: [HealthController],
        }).compile();

        controller = module.get(HealthController);
    });

    afterAll(async () => {
        await module.close();
    });

    it('reports ok while mongo is connected', () => {
        const result = controller.check();

        expect(result.status).toBe('ok');
        expect(result.database).toBe('up');
        expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('throws 503 when mongo is not connected', () => {
        const disconnected = new HealthController({ readyState: 0 } as Connection);

        expect(() => disconnected.check()).toThrow(ServiceUnavailableException);
    });
});
