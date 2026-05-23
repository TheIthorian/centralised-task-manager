# database

MongoDB connection module for `apps/main`.

Centralises the Mongoose connection so `MONGODB_URI` is read from config in one place and the connection is shared app-wide. Without this, each feature module would need to configure its own connection. Feature modules register their own schemas separately via `MongooseModule.forFeature`.
