import { z } from 'zod';
import type { RefreshDto as IRefreshDto } from '@ctm/api-client';
import { createZodDto, requestObject } from '@ctm/nest-common';

// Defaulted so a refresh that relies on the ctm_refresh cookie parses with no body at all.
export const refreshSchema = requestObject({
    refreshToken: z
        .string()
        .min(1)
        .max(4096)
        .optional()
        .describe(
            'Refresh token issued by POST /auth/login or /auth/register. Omit when the ctm_refresh cookie is present.',
        ),
}).default({});

export class RefreshDto extends createZodDto<IRefreshDto>({ schema: refreshSchema, name: 'RefreshDto' }) {}
