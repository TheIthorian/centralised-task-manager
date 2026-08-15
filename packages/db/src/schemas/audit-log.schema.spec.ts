import { describe, it, expect } from 'vitest';
import { AuditAction, AuditTargetType } from '../audit.js';
import { AuditLogSchema } from './audit-log.schema.js';

describe('AuditLogSchema', () => {
    it('records createdAt but never updatedAt, because entries are never modified', () => {
        expect(AuditLogSchema.path('createdAt')).toBeDefined();
        expect(AuditLogSchema.path('updatedAt')).toBeUndefined();
    });

    it('indexes newest-first for the log view', () => {
        const hasCreatedAtDesc = AuditLogSchema.indexes().some(
            ([fields]) => (fields as Record<string, unknown>)['createdAt'] === -1,
        );

        expect(hasCreatedAtDesc).toBe(true);
    });

    it('indexes target lookups for the history of one object', () => {
        const hasTargetIndex = AuditLogSchema.indexes().some(([fields]) => {
            const keys = fields as Record<string, unknown>;

            return keys['targetType'] === 1 && keys['targetId'] === 1;
        });

        expect(hasTargetIndex).toBe(true);
    });

    it('constrains action and targetType to the known vocabulary', () => {
        expect(Object.values(AuditLogSchema.path('action').options.enum)).toEqual(Object.values(AuditAction));
        expect(Object.values(AuditLogSchema.path('targetType').options.enum)).toEqual(
            Object.values(AuditTargetType),
        );
    });

    it('bounds every stored string', () => {
        expect(AuditLogSchema.path('actor').options.maxlength).toBe(200);
        expect(AuditLogSchema.path('targetId').options.maxlength).toBe(200);
        expect(AuditLogSchema.path('targetLabel').options.maxlength).toBe(320);
        expect(AuditLogSchema.path('ip').options.maxlength).toBe(45);
    });
});
