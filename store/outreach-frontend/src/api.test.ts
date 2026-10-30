import { outreachApi, paperRef } from './api';

test('a typed paper id is read as a DOI, PMCID, PMID or neurostore id', () => {
    expect(paperRef('10.1016/j.neuroimage.2026.1')).toEqual({ doi: '10.1016/j.neuroimage.2026.1' });
    expect(paperRef('https://doi.org/10.1/x')).toEqual({ doi: '10.1/x' });
    expect(paperRef(' pmc1234567 ')).toEqual({ pmcid: 'PMC1234567' });
    expect(paperRef('38123456')).toEqual({ pmid: '38123456' });
    expect(paperRef('W2ghyMFb8WWK')).toEqual({ base_study_id: 'W2ghyMFb8WWK' });
    expect(paperRef('  ')).toBeNull();
});

test('the API root is the main site\'s, /api included, or /api on this origin', async () => {
    const calls: string[] = [];
    const fetch = vi.fn(async (url: string) => {
        calls.push(url);
        return new Response(JSON.stringify({ admin: 'x' }), { headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetch);
    await outreachApi('https://neurostore.org/api', async () => null).me();
    await outreachApi('https://neurostore.org/api/', async () => null).me();
    await outreachApi('', async () => null).me();
    vi.unstubAllGlobals();
    expect(calls).toEqual([
        'https://neurostore.org/api/outreach/me',
        'https://neurostore.org/api/outreach/me',
        '/api/outreach/me',
    ]);
});
