import type { ClientSession, Connection } from 'mongoose';

/** Whether a connection's server can start a transaction, resolved once per connection. */
const transactionSupport = new WeakMap<Connection, Promise<boolean>>();

/**
 * Run `fn` inside a MongoDB transaction, committing when it resolves and aborting when it throws.
 * The session is passed in so every write inside can join it: a write that omits the session runs
 * outside the transaction and will not be rolled back.
 *
 * Transactions need a replica set or a sharded cluster. Against a standalone mongod the work still
 * runs, and still shares one session, but without atomicity — `onDegraded` fires once per
 * connection so a deployment that expected transactions can say so out loud.
 */
export async function runInTransaction<T>({
    connection,
    fn,
    onDegraded,
}: {
    connection: Connection;
    fn: (session: ClientSession) => Promise<T>;
    onDegraded?: () => void;
}): Promise<T> {
    const supported = await supportsTransactions({ connection, onDegraded });
    const session = await connection.startSession();

    try {
        if (!supported) return await fn(session);

        return await session.withTransaction(() => fn(session));
    } finally {
        await session.endSession();
    }
}

/**
 * Whether this connection's server can start a transaction. Asks the server directly rather than
 * reading the connection string, so a URI that names no replica set still gets transactions when
 * it happens to point at one.
 */
export async function supportsTransactions({
    connection,
    onDegraded,
}: {
    connection: Connection;
    onDegraded?: () => void;
}): Promise<boolean> {
    const cached = transactionSupport.get(connection);

    if (cached) return cached;

    const probe = probeTransactionSupport(connection).then((supported) => {
        if (!supported) onDegraded?.();

        return supported;
    });

    transactionSupport.set(connection, probe);

    return probe;
}

async function probeTransactionSupport(connection: Connection): Promise<boolean> {
    const db = connection.db;

    if (!db) return false;

    // `setName` is only present on a replica set member; `isdbgrid` identifies a mongos.
    const hello = (await db.admin().command({ hello: 1 })) as { setName?: string; msg?: string };

    return hello.setName !== undefined || hello.msg === 'isdbgrid';
}
