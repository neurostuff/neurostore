import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('randomUUID', () => {
    it('gives a version 4 UUID from the native API when there is one', () => {
        expect(randomUUID()).toMatch(V4);
    });

    it('gives a version 4 UUID from getRandomValues when the native API is absent', () => {
        const native = globalThis.crypto;
        vi.stubGlobal('crypto', {
            getRandomValues: <T extends ArrayBufferView>(array: T) => native.getRandomValues(array),
        });
        const ids = new Set(Array.from({ length: 50 }, () => randomUUID()));
        expect(ids.size).toBe(50);
        for (const id of ids) expect(id).toMatch(V4);
    });

    it('sets the version and variant bits of the fallback', () => {
        vi.stubGlobal('crypto', {
            getRandomValues: <T extends ArrayBufferView>(array: T) => (array as unknown as Uint8Array).fill(0xff),
        });
        expect(randomUUID()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    });
});
