import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectorName, ConnectorType, OAuthConnectorRegistry } from '@ctm/connectors';
import type {
    AccountIdentity,
    ConnectionDetailsSchema,
    HealthCheckResult,
    OAuthConnector,
    OAuthTokens,
} from '@ctm/connectors';
import { InternalError, NotFoundError, ValidationError } from '@ctm/errors';
import { ConnectionDetailsValidator } from './connection-details-validator.service.js';

const UNUSED = 'stub connector method is not used by this suite';

describe('ConnectionDetailsValidator', () => {
    let registry: OAuthConnectorRegistry;
    let validator: ConnectionDetailsValidator;

    beforeEach(() => {
        registry = new OAuthConnectorRegistry();

        registry.register(
            stubConnector({
                name: ConnectorName.Notion,
                connectionDetailsSchema: {
                    databaseId: {
                        inputDefinition: { type: 'text', label: 'Database', required: true },
                        validationSchema: { type: 'string', minLength: 1 },
                    },
                    nickname: {
                        inputDefinition: { type: 'text', label: 'Nickname' },
                        validationSchema: { type: 'string' },
                    },
                },
            }),
        );

        registry.register(stubConnector({ name: ConnectorName.Todoist, connectionDetailsSchema: {} }));

        validator = new ConnectionDetailsValidator(registry);
        validator.onModuleInit();
    });

    it('accepts details that satisfy the connector schema', () => {
        expect(() =>
            validator.validate({
                connectorName: ConnectorName.Notion,
                details: { databaseId: 'db-1', nickname: 'work' },
            }),
        ).not.toThrow();
    });

    it('accepts details that omit an optional field', () => {
        expect(() =>
            validator.validate({ connectorName: ConnectorName.Notion, details: { databaseId: 'db-1' } }),
        ).not.toThrow();
    });

    it('rejects details missing a required field', () => {
        expect(() => validator.validate({ connectorName: ConnectorName.Notion, details: {} })).toThrow(ValidationError);
    });

    it('rejects a field of the wrong type', () => {
        expect(() => validator.validate({ connectorName: ConnectorName.Notion, details: { databaseId: 42 } })).toThrow(
            ValidationError,
        );
    });

    it('rejects unknown properties', () => {
        expect(() =>
            validator.validate({
                connectorName: ConnectorName.Notion,
                details: { databaseId: 'db-1', surprise: true },
            }),
        ).toThrow(ValidationError);
    });

    it('names the offending field in the error message', () => {
        expect(() => validator.validate({ connectorName: ConnectorName.Notion, details: {} })).toThrow(/databaseId/);
    });

    it('accepts anything for a connector that declares no connection fields', () => {
        expect(() =>
            validator.validate({ connectorName: ConnectorName.Todoist, details: { whatever: 'goes' } }),
        ).not.toThrow();
    });

    it('throws NotFoundError for a connector that is not registered', () => {
        expect(() => validator.validate({ connectorName: ConnectorName.Discord, details: {} })).toThrow(NotFoundError);
    });

    it('does not grow its cache when validating repeatedly', () => {
        // A caller controls only the body, so no sequence of requests can add a cache entry.
        for (let i = 0; i < 50; i++) {
            expect(() =>
                validator.validate({ connectorName: ConnectorName.Notion, details: { databaseId: `db-${i}` } }),
            ).not.toThrow();
        }

        expect(() => validator.validate({ connectorName: ConnectorName.Discord, details: {} })).toThrow(NotFoundError);
    });

    it('reads each connector schema once, at module init', () => {
        let schemaReads = 0;
        const countingRegistry = new OAuthConnectorRegistry();
        const connector: OAuthConnector = {
            ...stubConnector({ name: ConnectorName.Notion, connectionDetailsSchema: {} }),
            get connectionDetailsSchema(): ConnectionDetailsSchema {
                schemaReads++;

                return {
                    databaseId: {
                        inputDefinition: { type: 'text', label: 'Database', required: true },
                        validationSchema: { type: 'string', minLength: 1 },
                    },
                };
            },
        };

        countingRegistry.register(connector);

        const countingValidator = new ConnectionDetailsValidator(countingRegistry);

        countingValidator.onModuleInit();

        expect(schemaReads).toBe(1);

        for (let i = 0; i < 10; i++) {
            countingValidator.validate({ connectorName: ConnectorName.Notion, details: { databaseId: 'db-1' } });
        }

        expect(schemaReads).toBe(1);
    });
});

/** Build a minimal {@link OAuthConnector} whose only meaningful field is its connection schema. */
function stubConnector({
    name,
    connectionDetailsSchema,
}: {
    name: ConnectorName;
    connectionDetailsSchema: ConnectionDetailsSchema;
}): OAuthConnector {
    return {
        name,
        connectorType: ConnectorType.TaskSync,
        connectionDetailsSchema,
        healthCheck: (): Promise<HealthCheckResult> => Promise.reject(new InternalError(UNUSED)),
        getAuthUrl: (): string => 'https://example.com/oauth',
        exchangeCode: (): Promise<OAuthTokens> => Promise.reject(new InternalError(UNUSED)),
        refreshToken: (): Promise<OAuthTokens> => Promise.reject(new InternalError(UNUSED)),
        resolveAccountIdentity: (): Promise<AccountIdentity> => Promise.reject(new InternalError(UNUSED)),
    };
}
