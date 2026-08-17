import { isIP } from 'node:net';

const IPV4_MAPPED_PREFIX = '::ffff:';

/**
 * Returns true if the address is a globally routable unicast address.
 *
 * Anything else (loopback, private, link-local, shared CGNAT, multicast, reserved) is treated as
 * internal: an outbound fetch to one of those ranges reaches this deployment's own network.
 */
export function isPublicUnicastAddress(address: string): boolean {
    const version = isIP(address);

    if (version === 4) return isPublicIpv4(address);
    if (version === 6) return isPublicIpv6(address);

    return false;
}

function isPublicIpv4(address: string): boolean {
    const octets = address.split('.').map(Number);

    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return false;
    }

    const [a, b] = octets as [number, number, number, number];

    if (a === 0) return false; // "this network"
    if (a === 10) return false; // private
    if (a === 127) return false; // loopback
    if (a === 100 && b >= 64 && b <= 127) return false; // shared address space (CGNAT)
    if (a === 169 && b === 254) return false; // link-local
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 0) return false; // IETF protocol assignments and TEST-NET-1
    if (a === 192 && b === 168) return false; // private
    if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
    if (a === 198 && b === 51) return false; // TEST-NET-2
    if (a === 203 && b === 0) return false; // TEST-NET-3
    if (a >= 224) return false; // multicast, reserved and broadcast

    return true;
}

function isPublicIpv6(address: string): boolean {
    const normalized = address.toLowerCase().split('%')[0] ?? '';

    // A v4-mapped address reaches the v4 host it embeds, so it is judged as that address.
    if (normalized.startsWith(IPV4_MAPPED_PREFIX)) {
        return isPublicUnicastAddress(normalized.slice(IPV4_MAPPED_PREFIX.length));
    }

    if (normalized === '::' || normalized === '::1') return false;

    const firstGroup = Number.parseInt(normalized.split(':')[0] || '0', 16);

    if ((firstGroup & 0xfe00) === 0xfc00) return false; // unique local, fc00::/7
    if ((firstGroup & 0xffc0) === 0xfe80) return false; // link-local, fe80::/10
    if ((firstGroup & 0xff00) === 0xff00) return false; // multicast, ff00::/8

    // 64:ff9b::/96 and 2002::/16 translate to a v4 destination, which the v4 rules must judge.
    if (normalized.startsWith('64:ff9b:')) return false;
    if (normalized.startsWith('2002:')) return false;

    return true;
}
