/** Returns the best user-visible message from an unknown error. */
export function getErrorMessage(error: unknown, fallback: string): string {
    if (
        error !== null &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        error.message.length > 0
    ) {
        return error.message;
    }

    return fallback;
}
