import { NotFoundError } from '@ctm/errors';
import { ConnectorName, TaskConnectorName } from './types.js';
import type { OAuthConnector, ExternalTaskSource } from './types.js';

/** In-memory registry that maps source names to their {@link OAuthConnector} implementations. */
export class OAuthConnectorRegistry {
    private readonly connectors = new Map<ConnectorName, OAuthConnector>();

    /** Register a connector, overwriting any existing entry for the same source. */
    register(connector: OAuthConnector): void {
        this.connectors.set(connector.name, connector);
    }

    /** Retrieve a connector by name. Throws if not registered. */
    get(name: ConnectorName): OAuthConnector {
        const connector = this.connectors.get(name);

        if (!connector) {
            throw new NotFoundError(`connector:${name}`);
        }

        return connector;
    }

    /** List all registered connector names in registration order. */
    list(): ConnectorName[] {
        return Array.from(this.connectors.keys());
    }
}

/** In-memory registry that maps source names to their {@link ExternalTaskSource} implementations. */
export class ExternalTaskSourceRegistry {
    private readonly sources = new Map<TaskConnectorName, ExternalTaskSource>();

    /** Register a task source, overwriting any existing entry for the same name. */
    register(source: ExternalTaskSource): void {
        this.sources.set(source.name, source);
    }

    /** Retrieve a task source by name. Throws if not registered. */
    get(name: TaskConnectorName): ExternalTaskSource {
        const found = this.sources.get(name);

        if (!found) {
            throw new NotFoundError(`task-source:${name}`);
        }

        return found;
    }

    /** List all registered task source names in registration order. */
    list(): TaskConnectorName[] {
        return Array.from(this.sources.keys());
    }
}
