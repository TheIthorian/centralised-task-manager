import { z } from 'zod';

const MAX_TEXT = 10_000;
const MAX_NAME = 512;
const MAX_TASKS_PER_PART = 100_000;
const MAX_TAGS = 100;
const MAX_REMINDERS = 100;
const MAX_LOCATIONS = 100;

const isoDateSchema = z.string().min(1).max(64);

const importTaskSchema = z.object({
    source: z.string().min(1).max(MAX_NAME),
    sourceId: z.string().min(1).max(MAX_NAME),
    title: z.string().max(MAX_NAME).default(''),
    description: z.string().max(MAX_TEXT).nullish(),
    status: z.enum(['open', 'done', 'archived']).default('open'),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullish(),
    tags: z.array(z.string().max(MAX_NAME)).max(MAX_TAGS).default([]),
    due: z
        .object({
            date: isoDateSchema,
            timezone: z.string().max(MAX_NAME).nullish(),
            recurrence: z.string().max(MAX_NAME).nullish(),
        })
        .nullish(),
    deadlineDate: isoDateSchema.nullish(),
    duration: z
        .object({
            amount: z.number(),
            unit: z.enum(['minute', 'day']),
        })
        .nullish(),
    fuzzyDeadline: z
        .object({
            type: z.enum(['this_week', 'this_month', 'someday']),
            remindEvery: z.enum(['daily', 'weekly']).nullish(),
        })
        .nullish(),
    reminders: z
        .array(z.object({ remindAt: isoDateSchema, firedAt: isoDateSchema.nullish() }))
        .max(MAX_REMINDERS)
        .default([]),
    dueDateNotifiedAt: isoDateSchema.nullish(),
    locations: z
        .array(z.object({ name: z.string().max(MAX_NAME), googleMapsUrl: z.string().max(MAX_TEXT) }))
        .max(MAX_LOCATIONS)
        .default([]),
    syncedAt: isoDateSchema.nullish(),
});

/**
 * The parts of an export envelope an import reads. Uploaded files are third-party data rather
 * than an app request, so unrecognised keys are stripped instead of rejected.
 */
export const importEnvelopeSchema = z.object({
    version: z.string().max(16),
    exportId: z.string().min(1).max(MAX_NAME),
    part: z.number().int(),
    totalParts: z.number().int(),
    tasks: z.array(importTaskSchema).max(MAX_TASKS_PER_PART),
});

export type ImportEnvelope = z.infer<typeof importEnvelopeSchema>;
export type ImportTask = z.infer<typeof importTaskSchema>;
