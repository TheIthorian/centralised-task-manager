export type FieldOwnership = 'synced' | 'local';

/**
 * Who owns the fields of a task: a task written here stays here, anything that arrived from a
 * connector writes back to it.
 *
 * This is a placeholder for a per-field answer. Ownership really varies field by field, because a
 * connector that has no duration or no location cannot accept an edit to one, and only the
 * `TaskConnector` implementations in `packages/connectors` know which fields they support. Until
 * they report that capability map, every field of a task shares the ownership of the task itself.
 */
export function fieldOwnership(source: string): FieldOwnership {
    return source === 'local' ? 'local' : 'synced';
}
