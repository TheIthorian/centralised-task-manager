import { z } from 'zod';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { optionalOrNull } from '../../common/zod/param-schemas.js';

// Defaulted so a refresh that relies on the ctm_refresh cookie parses with no body at all.
export const refreshSchema = z
    .strictObject({
        refreshToken: optionalOrNull(z.string().min(1).max(4096)).describe(
            'Refresh token issued by POST /auth/login or /auth/register. Omit when the ctm_refresh cookie is present.',
        ),
    })
    .default({});

export class RefreshDto extends createZodDto({ schema: refreshSchema, name: 'RefreshDto' }) {}
