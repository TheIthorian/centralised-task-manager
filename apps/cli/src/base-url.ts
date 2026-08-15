import { ConfigurationError } from '@ctm/errors';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validate and canonicalise an API base URL.
 *
 * The base URL reaches an argv position in the secret-store commands and the browser launcher, so
 * a value that is not a URL at all must not get that far: anything starting with `-` would be read
 * as a flag by the tool receiving it, and `security delete-generic-password` takes flags that
 * select a different item than the one intended. Parsing through `URL` also normalises the key
 * tokens are stored under, so `http://host` and `http://host/` are one account rather than two.
 *
 * @throws ConfigurationError when the value is not an absolute http(s) URL.
 */
export function normalizeBaseUrl(baseUrl: string): string {
    let parsed: URL;

    try {
        parsed = new URL(baseUrl);
    } catch {
        throw new ConfigurationError(`Base URL must be an absolute http(s) URL, got: ${baseUrl}`);
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        throw new ConfigurationError(`Base URL must use http or https, got: ${parsed.protocol}`);
    }

    return parsed.origin + parsed.pathname.replace(/\/$/, '');
}
