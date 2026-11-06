import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256, sha256Hex } from './sha256';

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const encode = (text: string) => new TextEncoder().encode(text);

describe('sha256', () => {
    it('digests the empty input to the standard vector', () => {
        expect(hex(sha256(encode('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('digests "abc" to the standard vector', () => {
        expect(hex(sha256(encode('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('digests an input longer than one 64-byte block', () => {
        const text = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';
        expect(hex(sha256(encode(text)))).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    });
});

describe('sha256Hex', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('gives the hex digest of the UTF-8 text', async () => {
        expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('gives the same digest without crypto.subtle, outside a secure context', async () => {
        vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
        expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
});
