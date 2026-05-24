import { describe, it, expect } from 'vitest';
import { OAuthConnectorRegistry, ExternalTaskSourceRegistry } from './registry.js';
import type { OAuthConnector, ExternalTaskSource } from './types.js';

function makeStubOAuth(name: string): OAuthConnector {
    return {
        name,
        getAuthUrl: () => '',
        exchangeCode: async () => ({ accessToken: '', refreshToken: '', expiresAt: new Date() }),
        refreshToken: async (t) => t,
    };
}

function makeStubSource(name: string): ExternalTaskSource {
    return {
        name,
        fetchTasks: async () => [],
        createTask: async () => ({
            sourceId: '',
            title: '',
            description: null,
            status: 'open',
            priority: null,
            due: null,
            deadline: null,
            duration: null,
            parentSourceId: null,
            tags: [],
        }),
        updateTask: async () => ({
            sourceId: '',
            title: '',
            description: null,
            status: 'open',
            priority: null,
            due: null,
            deadline: null,
            duration: null,
            parentSourceId: null,
            tags: [],
        }),
        completeTask: async () => undefined,
        deleteTask: async () => undefined,
    };
}

describe('OAuthConnectorRegistry', () => {
    it('registers and retrieves a connector by source', () => {
        const registry = new OAuthConnectorRegistry();
        const connector = makeStubOAuth('todoist');
        registry.register(connector);
        expect(registry.get('todoist')).toBe(connector);
    });

    it('throws when getting an unregistered source', () => {
        const registry = new OAuthConnectorRegistry();
        expect(() => registry.get('unknown')).toThrow('connector:unknown not found');
    });

    it('lists all registered sources', () => {
        const registry = new OAuthConnectorRegistry();
        registry.register(makeStubOAuth('todoist'));
        registry.register(makeStubOAuth('google_tasks'));
        expect(registry.list()).toEqual(['todoist', 'google_tasks']);
    });

    it('overwrites a connector when registered twice with same source', () => {
        const registry = new OAuthConnectorRegistry();
        const first = makeStubOAuth('todoist');
        const second = makeStubOAuth('todoist');
        registry.register(first);
        registry.register(second);
        expect(registry.get('todoist')).toBe(second);
    });
});

describe('ExternalTaskSourceRegistry', () => {
    it('registers and retrieves a source by name', () => {
        const registry = new ExternalTaskSourceRegistry();
        const source = makeStubSource('todoist');
        registry.register(source);
        expect(registry.get('todoist')).toBe(source);
    });

    it('throws when getting an unregistered source', () => {
        const registry = new ExternalTaskSourceRegistry();
        expect(() => registry.get('unknown')).toThrow('task-source:unknown not found');
    });

    it('lists all registered sources', () => {
        const registry = new ExternalTaskSourceRegistry();
        registry.register(makeStubSource('todoist'));
        registry.register(makeStubSource('google_tasks'));
        expect(registry.list()).toEqual(['todoist', 'google_tasks']);
    });

    it('overwrites a source when registered twice with same name', () => {
        const registry = new ExternalTaskSourceRegistry();
        const first = makeStubSource('todoist');
        const second = makeStubSource('todoist');
        registry.register(first);
        registry.register(second);
        expect(registry.get('todoist')).toBe(second);
    });
});
