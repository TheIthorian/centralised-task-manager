/** Per-account resource caps. These are product decisions, not deployment knobs:
 *  changing one changes what the API promises, so it belongs in code and in review. */

/** Connected accounts a user may hold for any single connector type. */
export const MAX_CONNECTIONS_PER_CONNECTOR = 5;

/** Tasks a user may store across all sources. */
export const MAX_TASKS_PER_USER = 10_000;
