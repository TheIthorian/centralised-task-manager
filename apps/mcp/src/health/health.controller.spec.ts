import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
    it('reports ok', () => {
        const result = new HealthController().check();

        expect(result.status).toBe('ok');
        expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
});
