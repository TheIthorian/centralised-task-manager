import type { OAuthConnector, ExternalTaskSource } from './types.js';

/** In-memory registry that maps source names to their {@link OAuthConnector} implementations. */
export class OAuthConnectorRegistry {
    private readonly connectors = new Map<string, OAuthConnector>();

    /** Register a connector, overwriting any existing entry for the same source. */
    register(connector: OAuthConnector): void {
        this.connectors.set(connector.name, connector);
    }

    /** Retrieve a connector by source name. Throws if not registered. */
    get(source: string): OAuthConnector {
        const connector = this.connectors.get(source);

        if (!connector) {
            throw new Error(`No OAuth connector registered for source: ${source}`);
        }

        return connector;
    }

    /** List all registered source names in registration order. */
    list(): string[] {
        return Array.from(this.connectors.keys());
    }
}

/** In-memory registry that maps source names to their {@link ExternalTaskSource} implementations. */
export class ExternalTaskSourceRegistry {
    private readonly sources = new Map<string, ExternalTaskSource>();

    /** Register a task source, overwriting any existing entry for the same source. */
    register(source: ExternalTaskSource): void {
        this.sources.set(source.name, source);
    }

    /** Retrieve a task source by source name. Throws if not registered. */
    get(source: string): ExternalTaskSource {
        const found = this.sources.get(source);

        if (!found) {
            throw new Error(`No task source registered for source: ${source}`);
        }

        return found;
    }

    /** List all registered source names in registration order. */
    list(): string[] {
        return Array.from(this.sources.keys());
    }
}
