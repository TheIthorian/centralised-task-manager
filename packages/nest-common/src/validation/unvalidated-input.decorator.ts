import { SetMetadata } from '@nestjs/common';

export const UNVALIDATED_INPUT = 'ctm:unvalidated-input';

/**
 * Exempts a handler from the startup input-validation audit.
 *
 * Only for handlers that validate their own input by a route the audit cannot see, such as a
 * schema compiled from data at request time. The reason is required so the exemption is a
 * documented decision rather than a way to silence the check.
 */
export function UnvalidatedInput(reason: string): MethodDecorator {
    return SetMetadata(UNVALIDATED_INPUT, reason);
}
