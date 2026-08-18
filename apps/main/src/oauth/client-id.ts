import { z } from 'zod';

/**
 * Longest `client_id` this server accepts. A Client ID Metadata Document identifies its client by
 * URL rather than by an opaque id, so the bound has to leave room for one.
 */
export const MAX_CLIENT_ID_LENGTH = 512;

export const clientIdSchema = z.string().min(1).max(MAX_CLIENT_ID_LENGTH);

/**
 * Returns true when a `client_id` is a Client ID Metadata Document URL rather than an identifier
 * issued by this server: an https URL with a path component and no fragment
 * (draft-ietf-oauth-client-id-metadata-document-00 §3).
 */
export function isClientIdMetadataDocumentUrl(clientId: string): boolean {
    if (!URL.canParse(clientId)) return false;

    const url = new URL(clientId);

    if (url.protocol !== 'https:') return false;

    if (url.pathname === '/' || url.pathname === '') return false;

    if (url.hash.length > 0) return false;

    // Credentials in the URL would be sent on every fetch of the document.
    return url.username === '' && url.password === '';
}
