# database

MongoDB connection module for `apps/main`.

`DatabaseModule` is a thin wrapper around `@nestjs/mongoose`'s `MongooseModule.forRootAsync`. It reads `MONGODB_URI` from `ConfigService` and registers the connection for the whole app.

Imported once in `AppModule`; all feature modules import `MongooseModule.forFeature(...)` to register their schemas.
