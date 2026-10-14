import { makeBundle } from '../test/bundles';
import { fixtureApi } from './fixtureApi';

function serve(files: Record<string, unknown>) {
    const fetch = vi.fn(async (url: string) =>
        url in files ? new Response(JSON.stringify(files[url])) : new Response('missing', { status: 404 })
    );
    vi.stubGlobal('fetch', fetch);
    return fetch;
}

describe('fixtureApi', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('lists the papers in fixtures/index.json under the app’s base', async () => {
        serve({ '/review/fixtures/index.json': [{ id: 'P1', label: 'A paper' }] });
        expect(await fixtureApi('/review/').listPapers()).toEqual([{ id: 'P1', label: 'A paper' }]);
    });

    it('loads a paper’s bundle and fails clearly when it is missing', async () => {
        const bundle = makeBundle({}, 'text');
        serve({ '/review/fixtures/P1.bundle.json': bundle });
        expect(await fixtureApi('/review/').getBundle('P1')).toEqual(bundle);
        await expect(fixtureApi('/review/').getBundle('P2')).rejects.toThrow('P2.bundle.json: 404');
    });
});
