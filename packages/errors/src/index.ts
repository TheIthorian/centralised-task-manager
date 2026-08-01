/** Base application error carrying an HTTP status code and machine-readable error code. */
export class AppError extends Error {
    constructor(
        public override readonly message: string,
        public readonly code: string,
        public readonly statusCode: number,
    ) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** Thrown when a requested resource cannot be found (HTTP 404). */
export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, 'NOT_FOUND', 404);
    }
}

/** Thrown when a request lacks valid authentication (HTTP 401). */
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 'UNAUTHORIZED', 401);
    }
}

/** Thrown when an operation conflicts with existing state (HTTP 409). */
export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 'CONFLICT', 409);
    }
}

/** Thrown when an upstream/external service call fails (HTTP 502). */
export class ExternalServiceError extends AppError {
    constructor(service: string, message: string) {
        super(`${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502);
    }
}

/** Thrown when input or configuration fails validation (HTTP 400). */
export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR', 400);
    }
}

/** Thrown when an OAuth flow fails (e.g. missing tokens, revoked access) (HTTP 502). */
export class OAuthError extends AppError {
    constructor(message: string) {
        super(message, 'OAUTH_ERROR', 502);
    }
}

/** Thrown when a client exceeds a rate limit (HTTP 429). */
export class RateLimitError extends AppError {
    readonly retryAfterSeconds: number;

    constructor({ message, retryAfterSeconds }: { message: string; retryAfterSeconds: number }) {
        super(message, 'RATE_LIMIT_EXCEEDED', 429);
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

/** Thrown when an account has reached a hard resource cap (HTTP 403). */
export class QuotaExceededError extends AppError {
    constructor(message: string) {
        super(message, 'QUOTA_EXCEEDED', 403);
    }
}

/** Thrown when an unexpected internal error occurs (HTTP 500). */
export class InternalError extends AppError {
    constructor(message: string) {
        super(message, 'INTERNAL_ERROR', 500);
    }
}

/**
 * Thrown when the environment a process booted with is missing or contradictory. Always fatal at
 * startup: the status code exists only because every `AppError` carries one.
 */
export class ConfigurationError extends AppError {
    constructor(message: string) {
        super(message, 'CONFIGURATION_ERROR', 500);
    }
}
