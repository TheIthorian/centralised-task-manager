import type { Types } from 'mongoose';

/**
 * A task's identity as the domain passes it around. An alias rather than a wrapper class: it costs
 * nothing at runtime and serialises exactly as the underlying id does, while giving every signature
 * that names an id one place to change if the id type ever does.
 *
 * Values arriving from a client stay `string` until the service converts them.
 */
export type TaskId = Types.ObjectId;
