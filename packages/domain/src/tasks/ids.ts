import type { Types } from 'mongoose';

/** A task's identity. Ids arriving from a client stay `string` until the service converts them. */
export type TaskId = Types.ObjectId;
