import { afterEach, describe, expect, it, vi } from 'vitest';
import { mintLocalId } from './mint';

afterEach(() => vi.unstubAllGlobals());

describe('mintLocalId', () => {
    it('mints rv_ and the first 12 hex digits of sha256(client_op_id)', async () => {
        expect(await mintLocalId('abc', new Set())).toBe('rv_ba7816bf8f01');
    });

    it('suffixes a taken id', async () => {
        expect(await mintLocalId('abc', new Set(['rv_ba7816bf8f01']))).toBe('rv_ba7816bf8f01_2');
    });

    it('mints the same id without crypto.subtle, outside a secure context', async () => {
        vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
        expect(await mintLocalId('abc', new Set())).toBe('rv_ba7816bf8f01');
    });
});
