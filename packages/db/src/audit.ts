/** An operator action worth a permanent record. */
export enum AuditAction {
    UserDeleted = 'user.deleted',
    UserRestored = 'user.restored',
    UserPurged = 'user.purged',
    OAuthClientCreated = 'oauth_client.created',
    OAuthClientUpdated = 'oauth_client.updated',
    OAuthClientRevoked = 'oauth_client.revoked',
}

/** The kind of thing an audited action was performed on. */
export enum AuditTargetType {
    User = 'user',
    OAuthClient = 'oauth_client',
}
