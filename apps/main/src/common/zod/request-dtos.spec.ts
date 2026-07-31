import { describe, it, expect } from 'vitest';
import type { ZodType } from 'zod';
import { loginSchema } from '../../auth/dto/login.dto.js';
import { registerSchema } from '../../auth/dto/register.dto.js';
import { refreshSchema } from '../../auth/dto/refresh.dto.js';
import { updateUserSchema } from '../../users/dto/update-user.dto.js';
import { createTaskSchema } from '../../tasks/dto/create-task.dto.js';
import { updateTaskSchema } from '../../tasks/dto/update-task.dto.js';
import { listTasksQuerySchema } from '../../tasks/dto/list-tasks-query.dto.js';
import { addReminderSchema } from '../../tasks/dto/add-reminder.dto.js';
import { setFuzzyDeadlineSchema } from '../../tasks/dto/set-fuzzy-deadline.dto.js';
import { setTaskStatusSchema } from '../../tasks/dto/set-task-status.dto.js';
import { taskRelationSchema } from '../../tasks/dto/task-relation.dto.js';
import { listNotificationsQuerySchema } from '../../notifications/dto/list-notifications-query.dto.js';
import { updatePreferencesSchema } from '../../notifications/dto/update-preferences.dto.js';
import { updateConnectorSchema } from '../../connectors/dto/update-connector.dto.js';
import { importRequestSchema } from '../../data-portability/dto/import-request.dto.js';

/**
 * Every request schema an app client posts to. Each carries the smallest body that should parse,
 * so the shared expectations below can be asserted against a realistic value.
 */
const APP_REQUEST_SCHEMAS: [name: string, schema: ZodType, valid: Record<string, unknown>][] = [
    ['loginSchema', loginSchema, { email: 'a@example.com', password: 'hunter22' }],
    ['registerSchema', registerSchema, { name: 'Ada', email: 'a@example.com', password: 'hunter22' }],
    ['refreshSchema', refreshSchema, {}],
    ['updateUserSchema', updateUserSchema, {}],
    ['createTaskSchema', createTaskSchema, { title: 'Write it down', source: 'todoist' }],
    ['updateTaskSchema', updateTaskSchema, { title: 'Write it down' }],
    ['listTasksQuerySchema', listTasksQuerySchema, {}],
    ['addReminderSchema', addReminderSchema, { remindAt: '2026-06-01T14:00:00.000Z' }],
    ['setFuzzyDeadlineSchema', setFuzzyDeadlineSchema, { type: 'this_week' }],
    ['setTaskStatusSchema', setTaskStatusSchema, { status: 'done' }],
    ['taskRelationSchema', taskRelationSchema, { type: 'child', targetTaskId: '507f1f77bcf86cd799439011' }],
    ['listNotificationsQuerySchema', listNotificationsQuerySchema, {}],
    ['updatePreferencesSchema', updatePreferencesSchema, { reminder: { inApp: true } }],
    ['updateConnectorSchema', updateConnectorSchema, { enabled: true }],
    ['importRequestSchema', importRequestSchema, {}],
];

describe.each(APP_REQUEST_SCHEMAS)('%s', (_name, schema, valid) => {
    it('accepts a minimal valid body', () => {
        expect(schema.safeParse(valid).success).toBe(true);
    });

    it('rejects an unrecognised key', () => {
        expect(schema.safeParse({ ...valid, notAField: 'x' }).success).toBe(false);
    });

    // A client round-tripping a response back as a request sends null for what it did not set.
    it('reads an explicit null as an absent key', () => {
        expect(schema.safeParse({ ...valid, notAField: null }).success).toBe(true);
    });
});

describe('refreshSchema', () => {
    it('parses an absent body, so a cookie-only refresh needs no payload', () => {
        expect(refreshSchema.parse(undefined)).toEqual({});
    });
});

describe('loginSchema', () => {
    it('rejects a password below the minimum length', () => {
        expect(loginSchema.safeParse({ email: 'a@example.com', password: 'short' }).success).toBe(false);
    });

    it('rejects a malformed email', () => {
        expect(loginSchema.safeParse({ email: 'not-an-email', password: 'hunter22' }).success).toBe(false);
    });
});

describe('registerSchema', () => {
    it('rejects a name past its bound', () => {
        const body = { name: 'a'.repeat(101), email: 'a@example.com', password: 'hunter22' };

        expect(registerSchema.safeParse(body).success).toBe(false);
    });
});
