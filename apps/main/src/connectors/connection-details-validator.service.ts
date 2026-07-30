import { Injectable, type OnModuleInit } from '@nestjs/common';
import { OAuthConnectorRegistry } from '@ctm/connectors';
import type { ConnectionDetailsSchema, ConnectorName } from '@ctm/connectors';
import { NotFoundError, ValidationError } from '@ctm/errors';
import Ajv from 'ajv';
import type { ValidateFunction } from 'ajv';

/**
 * Validates connector connection details against the JSON Schema the connector supplies.
 *
 * Ajv compilation is the expensive step and each connector's schema is static, so every validator
 * is compiled once at bootstrap and reused for the process lifetime.
 */
@Injectable()
export class ConnectionDetailsValidator implements OnModuleInit {
    private readonly ajv = new Ajv();

    /**
     * One entry per registered connector, `null` when the connector declares no fields. Written
     * only by {@link onModuleInit}: no request path inserts, so a caller cannot grow this map.
     */
    private readonly validators = new Map<ConnectorName, ValidateFunction | null>();

    constructor(private readonly registry: OAuthConnectorRegistry) {}

    /** Compile a validator for every registered connector so no request pays the compile cost. */
    onModuleInit(): void {
        for (const connectorName of this.registry.list()) {
            const schema = this.registry.get(connectorName).connectionDetailsSchema;

            this.validators.set(connectorName, compileConnectionDetailsSchema({ ajv: this.ajv, schema }));
        }
    }

    /**
     * Check connection details against their connector's schema.
     *
     * @throws NotFoundError when the connector is not registered.
     * @throws ValidationError when the details do not satisfy the connector's schema.
     */
    validate({ connectorName, details }: { connectorName: ConnectorName; details: Record<string, unknown> }): void {
        if (!this.validators.has(connectorName)) {
            throw new NotFoundError(`connector:${connectorName}`);
        }

        const validate = this.validators.get(connectorName);

        if (!validate) return;

        if (!validate(details)) {
            throw new ValidationError(`Invalid connection details: ${this.ajv.errorsText(validate.errors)}`);
        }
    }
}

/**
 * Build the Ajv validator for a connector's connection fields.
 *
 * @returns `null` when the connector declares no fields, so there is nothing to validate.
 */
function compileConnectionDetailsSchema({
    ajv,
    schema,
}: {
    ajv: Ajv;
    schema: ConnectionDetailsSchema;
}): ValidateFunction | null {
    const fields = Object.entries(schema);

    if (fields.length === 0) return null;

    return ajv.compile({
        type: 'object',
        properties: Object.fromEntries(fields.map(([key, field]) => [key, field.validationSchema])),
        required: fields.filter(([, field]) => field.inputDefinition.required).map(([key]) => key),
        additionalProperties: false,
    });
}
