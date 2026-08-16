import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { STATES, type Connection } from 'mongoose';
import type { Logger } from '@ctm/logger';
import { appLogger } from '../logging/app-logger.js';

/**
 * Opens the MongoDB connection on demand and closes it again once nothing is using it.
 *
 * The driver's topology monitor keeps a socket open to every replica-set member and sends `hello`
 * on each every `heartbeatFrequencyMS`, independently of the pool. Those monitors only stop when
 * the connection is closed, so an always-open connection means constant network traffic and a
 * container that never looks idle to the platform.
 */
@Injectable()
export class IdleConnectionService implements OnApplicationShutdown {
    private readonly uri: string;
    private readonly idleTimeoutMs: number;
    private readonly logger: Logger = appLogger('IdleConnectionService');

    private inFlight = 0;
    private opening: Promise<void> | undefined;
    private idleTimer: NodeJS.Timeout | undefined;
    private shuttingDown = false;

    constructor(
        @Inject(getConnectionToken()) private readonly connection: Connection,
        config: ConfigService,
    ) {
        this.uri = config.getOrThrow<string>('MONGODB_URI');
        this.idleTimeoutMs = config.getOrThrow<number>('MONGODB_IDLE_TIMEOUT_MS');
    }

    /**
     * Open the connection if it is closed and count the caller as in flight.
     *
     * Callers must pair this with `release` even when it throws, or the connection never goes idle
     * again.
     */
    async acquire(): Promise<void> {
        this.inFlight += 1;
        this.cancelIdleTimer();

        await this.open();
    }

    /** Mark one caller as finished, and start the idle countdown when it was the last. */
    release(): void {
        this.inFlight = Math.max(0, this.inFlight - 1);

        if (this.inFlight === 0) this.startIdleTimer();
    }

    /** Close the connection for good, so a shutdown is not held open by the idle timer. */
    async onApplicationShutdown(): Promise<void> {
        this.shuttingDown = true;
        this.cancelIdleTimer();

        await this.connection.close();
    }

    // Concurrent requests during a cold start share one openUri call: mongoose treats a second
    // open on a connecting connection as an error rather than a no-op.
    private async open(): Promise<void> {
        if (this.connection.readyState === STATES.connected) return;

        this.opening ??= this.openUri();

        try {
            await this.opening;
        } finally {
            this.opening = undefined;
        }
    }

    private async openUri(): Promise<void> {
        this.logger.debug('Opening MongoDB connection');

        await this.connection.openUri(this.uri);

        this.logger.debug('MongoDB connection open');
    }

    private startIdleTimer(): void {
        if (this.shuttingDown || this.connection.readyState === STATES.disconnected) return;

        this.cancelIdleTimer();

        this.idleTimer = setTimeout(() => {
            void this.closeIfIdle();
        }, this.idleTimeoutMs);

        // Nothing is waiting on this timer, so it should not be a reason the process stays alive.
        this.idleTimer.unref();
    }

    private cancelIdleTimer(): void {
        if (!this.idleTimer) return;

        clearTimeout(this.idleTimer);
        this.idleTimer = undefined;
    }

    private async closeIfIdle(): Promise<void> {
        this.idleTimer = undefined;

        if (this.inFlight > 0 || this.connection.readyState === STATES.disconnected) return;

        this.logger.debug('Closing idle MongoDB connection');

        await this.connection.close();
    }
}
