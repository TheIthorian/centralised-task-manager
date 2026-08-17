import { describe, it, expect } from 'vitest';
import { isPublicUnicastAddress } from './ip-address.js';

describe('isPublicUnicastAddress', () => {
    it.each(['1.1.1.1', '8.8.8.8', '203.1.2.3', '2606:4700:4700::1111'])('accepts %s', (address) => {
        expect(isPublicUnicastAddress(address)).toBe(true);
    });

    it.each([
        '0.0.0.0',
        '10.0.0.1',
        '127.0.0.1',
        '100.64.0.1',
        '169.254.169.254',
        '172.16.0.1',
        '172.31.255.255',
        '192.0.0.1',
        '192.168.1.1',
        '198.18.0.1',
        '224.0.0.1',
        '255.255.255.255',
        '::',
        '::1',
        'fc00::1',
        'fd12:3456::1',
        'fe80::1',
        'ff02::1',
        '::ffff:127.0.0.1',
        '::ffff:169.254.169.254',
        '2002:7f00:0001::',
        '64:ff9b::7f00:1',
    ])('rejects %s', (address) => {
        expect(isPublicUnicastAddress(address)).toBe(false);
    });

    it.each(['', 'not-an-ip', 'example.com', '1.2.3'])('rejects the non-address %s', (value) => {
        expect(isPublicUnicastAddress(value)).toBe(false);
    });

    it('rejects a link-local address carrying a zone id', () => {
        expect(isPublicUnicastAddress('fe80::1%eth0')).toBe(false);
    });
});
