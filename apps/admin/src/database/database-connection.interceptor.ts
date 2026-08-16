import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { finalize, from, switchMap, type Observable } from 'rxjs';
import { IdleConnectionService } from './idle-connection.service.js';

/**
 * Holds the MongoDB connection open for the duration of a request, opening it first if the idle
 * timer had closed it.
 *
 * Nest runs guards before interceptors, so `AdminGuard` has already rejected an unauthenticated
 * request by the time this runs: an anonymous caller cannot wake the database.
 *
 * Waiting for the connection here rather than relying on mongoose's command buffering keeps a cold
 * start bounded by server selection instead of by `bufferTimeoutMS`.
 */
@Injectable()
export class DatabaseConnectionInterceptor implements NestInterceptor {
    constructor(private readonly connections: IdleConnectionService) {}

    /** Opens the connection before the handler runs and releases it once the response completes. */
    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return from(this.connections.acquire()).pipe(
            switchMap(() => next.handle()),
            finalize(() => this.connections.release()),
        );
    }
}
