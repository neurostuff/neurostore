import { filterStubsBySearch } from './CurationBoardAIInterfaceExclude.helpers';
import { ICurationStubStudy } from '../Curation.types';

const makeStub = (over: Partial<ICurationStubStudy>): ICurationStubStudy => ({
    id: 'id',
    title: '',
    authors: '',
    keywords: '',
    pmid: '',
    pmcid: '',
    doi: '',
    articleYear: undefined,
    journal: '',
    abstractText: '',
    articleLink: '',
    exclusionTag: null,
    identificationSource: { id: 'src', label: 'src' } as ICurationStubStudy['identificationSource'],
    tags: [],
    ...over,
});

const stubs = [
    makeStub({ id: '1', title: 'Sleep and memory', authors: 'Smith J' }),
    makeStub({ id: '2', title: 'Pain perception', authors: 'Wager T', journal: 'Science', articleYear: '2004' }),
    makeStub({ id: '3', title: 'Fear conditioning', keywords: 'amygdala', pmid: '12345', doi: '10.1/x' }),
];
const ids = (result: ICurationStubStudy[]) => result.map((s) => s.id);

describe('filterStubsBySearch', () => {
    it('returns all stubs for an empty or whitespace term', () => {
        expect(filterStubsBySearch(stubs, '')).toHaveLength(3);
        expect(filterStubsBySearch(stubs, '   ')).toHaveLength(3);
    });
    it('matches title case-insensitively', () => {
        expect(ids(filterStubsBySearch(stubs, 'SLEEP'))).toEqual(['1']);
    });
    it('matches authors', () => {
        expect(ids(filterStubsBySearch(stubs, 'wager'))).toEqual(['2']);
    });
    it('matches journal', () => {
        expect(ids(filterStubsBySearch(stubs, 'science'))).toEqual(['2']);
    });
    it('matches articleYear', () => {
        expect(ids(filterStubsBySearch(stubs, '2004'))).toEqual(['2']);
    });
    it('matches keywords', () => {
        expect(ids(filterStubsBySearch(stubs, 'amygdala'))).toEqual(['3']);
    });
    it('matches pmid and doi', () => {
        expect(ids(filterStubsBySearch(stubs, '12345'))).toEqual(['3']);
        expect(ids(filterStubsBySearch(stubs, '10.1/x'))).toEqual(['3']);
    });
    it('returns [] when nothing matches', () => {
        expect(filterStubsBySearch(stubs, 'zzzznomatch')).toEqual([]);
    });
});
