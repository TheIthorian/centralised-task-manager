import type { TaskConnector } from './types.js';

export class ConnectorRegistry {
    private readonly connectors = new Map<string, TaskConnector>();

    /** Register a connector, overwriting any existing connector for the same source. */
    register(connector: TaskConnector): void {
        this.connectors.set(connector.source, connector);
    }

    /** Retrieve a connector by source name. Throws if not registered. */
    get(source: string): TaskConnector {
        const connector = this.connectors.get(source);

        if (!connector) {
            throw new Error(`No connector registered for source: ${source}`);
        }

        return connector;
    }

    /** List all registered source names in registration order. */
    list(): string[] {
        return Array.from(this.connectors.keys());
    }
}
