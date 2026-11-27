import { paperLinks } from './links';

test('a paper links to its DOI, PubMed record and PMC full text, as the main app does', () => {
    expect(paperLinks({ doi: '10.1/x', pmid: '12345678', pmcid: 'PMC1234567' }).map((l) => l.href)).toEqual([
        'https://doi.org/10.1/x',
        'https://pubmed.ncbi.nlm.nih.gov/12345678',
        'https://ncbi.nlm.nih.gov/pmc/articles/PMC1234567',
    ]);
});

test('only the ids a paper has become links, and a bare PMCID gets its prefix', () => {
    expect(paperLinks({ doi: null, pmid: null, pmcid: '1234567' })).toEqual([
        expect.objectContaining({ label: 'Full text (PMC)', href: 'https://ncbi.nlm.nih.gov/pmc/articles/PMC1234567' }),
    ]);
    expect(paperLinks({ doi: null, pmid: null, pmcid: null })).toEqual([]);
});
