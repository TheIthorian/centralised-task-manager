import { z } from 'zod';
import type { LocationDto as ILocationDto, UpdateTaskDto as IUpdateTaskDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { isoDateTimeSchema, optionalOrNull } from '../../common/zod/param-schemas.js';

export const MAX_TAGS = 50;
export const MAX_LOCATIONS = 20;

export const locationSchema = z.strictObject({
    name: z.string().min(1).max(200),
    googleMapsUrl: z.string().max(500).url(),
});

export const dueDateSchema = z.strictObject({
    date: isoDateTimeSchema,
    timezone: optionalOrNull(z.string().max(64)),
    recurrence: optionalOrNull(z.string().max(200)),
});

export const durationSchema = z.strictObject({
    amount: z.number().int().min(1).max(100_000),
    unit: z.enum(['minute', 'day']),
});

/** Task priority, 1 (highest) to 4 (lowest), matching Todoist's scale. */
export const prioritySchema = z.literal([1, 2, 3, 4]);

export const tagsSchema = z.array(z.string().min(1).max(50)).max(MAX_TAGS);

export const locationsSchema = z.array(locationSchema).max(MAX_LOCATIONS);

export const updateTaskSchema = z.strictObject({
    title: optionalOrNull(z.string().min(1).max(200)),
    description: optionalOrNull(z.string().max(2000)),
    due: optionalOrNull(dueDateSchema),
    deadlineDate: optionalOrNull(isoDateTimeSchema),
    duration: optionalOrNull(durationSchema),
    priority: optionalOrNull(prioritySchema),
    tags: optionalOrNull(tagsSchema),
    locations: optionalOrNull(locationsSchema).describe('Locations with Google Maps links'),
});

export class LocationDto extends createZodDto<ILocationDto>({ schema: locationSchema, name: 'LocationDto' }) {}

export class UpdateTaskDto extends createZodDto<IUpdateTaskDto>({
    schema: updateTaskSchema,
    name: 'UpdateTaskDto',
}) {}
