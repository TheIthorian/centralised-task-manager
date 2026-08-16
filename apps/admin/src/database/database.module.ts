import { Global, Module } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import mongoose, { type Connection } from 'mongoose';
import { IdleConnectionService } from './idle-connection.service.js';

/**
 * Provides the connection `MongooseModule.forFeature` binds its models to, without opening it.
 *
 * `MongooseModule.forRoot` is deliberately not used: it passes the URI to `createConnection`, which
 * dials immediately, and the driver's topology monitor then keeps sockets to the replica set alive
 * for the process lifetime. A connection created with no URI is inert until `IdleConnectionService`
 * opens it for a request, so an idle container is silent and can be scaled to zero.
 *
 * Global so the models registered by every feature module resolve this connection, which is what
 * `MongooseCoreModule` would otherwise be doing.
 */
@Global()
@Module({
    providers: [
        {
            provide: getConnectionToken(),
            useFactory: (): Connection => mongoose.createConnection(),
        },
        IdleConnectionService,
    ],
    exports: [getConnectionToken(), IdleConnectionService],
})
export class DatabaseModule {}
