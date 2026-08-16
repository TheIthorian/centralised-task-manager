import type { RelationType } from '@ctm/db';
import type { Types } from 'mongoose';

/** A typed edge from one task to another. */
export type TaskRelation = {
    type: RelationType;
    targetTaskId: Types.ObjectId;
};

/** Maps each relation type to the inverse type stored on the target task. */
export const RELATION_INVERSE: Record<RelationType, RelationType> = {
    parent: 'child',
    child: 'parent',
    next: 'previous',
    previous: 'next',
    related: 'related',
};

/** The relation type the target task stores pointing back at the source. */
export function inverseOf(type: RelationType): RelationType {
    return RELATION_INVERSE[type];
}
