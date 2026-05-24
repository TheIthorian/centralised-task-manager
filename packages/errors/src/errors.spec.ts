import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, UnauthorizedError, ConflictError, ExternalServiceError, ValidationError, InternalError } from './index.js';

describe('AppError', () => {
    it('sets name, message, code, statusCode', () => {
        const err = new AppError('bad thing', 'ERR_GENERIC', 500);
        expect(err.message).toBe('bad thing');
        expect(err.code).toBe('ERR_GENERIC');
        expect(err.statusCode).toBe(500);
        expect(err.name).toBe('AppError');
        expect(err).toBeInstanceOf(Error);
    });
});

describe('NotFoundError', () => {
    it('formats message and uses 404', () => {
        const err = new NotFoundError('Task');
        expect(err.message).toBe('Task not found');
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
    });
});

describe('UnauthorizedError', () => {
    it('uses 401 with default message', () => {
        const err = new UnauthorizedError();
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Unauthorized');
    });

    it('accepts custom message', () => {
        const err = new UnauthorizedError('Token expired');
        expect(err.message).toBe('Token expired');
    });
});

describe('ConflictError', () => {
    it('uses 409', () => {
        const err = new ConflictError('Email already taken');
        expect(err.statusCode).toBe(409);
        expect(err.message).toBe('Email already taken');
    });
});

describe('ExternalServiceError', () => {
    it('combines service name and message, uses 502', () => {
        const err = new ExternalServiceError('Todoist', 'rate limited');
        expect(err.message).toBe('Todoist: rate limited');
        expect(err.statusCode).toBe(502);
        expect(err.code).toBe('EXTERNAL_SERVICE_ERROR');
    });
});

describe('ValidationError', () => {
    it('uses 400 with VALIDATION_ERROR code', () => {
        const err = new ValidationError('databaseId is required');
        expect(err.message).toBe('databaseId is required');
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err).toBeInstanceOf(AppError);
    });
});

describe('InternalError', () => {
    it('uses 500 with INTERNAL_ERROR code', () => {
        const err = new InternalError('something broke');
        expect(err.message).toBe('something broke');
        expect(err.statusCode).toBe(500);
        expect(err.code).toBe('INTERNAL_ERROR');
        expect(err).toBeInstanceOf(AppError);
    });
});
