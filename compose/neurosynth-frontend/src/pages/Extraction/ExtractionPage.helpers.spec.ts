import { describe, expect, it } from 'vitest';
import { hasDifferenceBetweenStudysetAndCuration } from './ExtractionPage.helpers';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { StudyReturn } from 'neurostore-typescript-sdk';

const createStub = (overrides: Partial<ICurationStubStudy> = {}): ICurationStubStudy =>
    ({
        id: 'stub-1',
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
        identificationSource: { key: 'manual', label: 'Manual' },
        tags: [],
        ...overrides,
    }) as ICurationStubStudy;

const createStudy = (overrides: Partial<StudyReturn> = {}): StudyReturn =>
    ({
        id: 'study-1',
        name: '',
        pmid: undefined,
        doi: undefined,
        ...overrides,
    }) as StudyReturn;

describe('hasDifferenceBetweenStudysetAndCuration', () => {
    it('returns false when curation and studyset match by title/name', () => {
        const stubs = [createStub({ title: 'My Study' })];
        const studies = [createStudy({ name: 'My Study' })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(false);
    });

    it('returns false when curation and studyset match by pmid', () => {
        const stubs = [createStub({ pmid: '12345678' })];
        const studies = [createStudy({ pmid: '12345678' })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(false);
    });

    it('returns false when curation and studyset match by doi', () => {
        const stubs = [createStub({ doi: '10.1234/example' })];
        const studies = [createStudy({ doi: '10.1234/example' })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(false);
    });

    it('returns false when both arrays are empty', () => {
        expect(hasDifferenceBetweenStudysetAndCuration([], [])).toBe(false);
    });

    it('returns false when matching is case-insensitive', () => {
        const stubs = [createStub({ title: 'Neural Networks' })];
        const studies = [createStudy({ name: 'NEURAL NETWORKS' })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(false);
    });

    it('returns true when stub in curation has no matching study in studyset', () => {
        const stubs = [createStub({ title: 'Orphan Study' })];
        const studies = [createStudy({ name: 'Different Study' })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(true);
    });

    it('returns true when study in studyset has no matching stub in curation', () => {
        const stubs = [createStub({ title: 'Curation Study' })];
        const studies = [
            createStudy({ name: 'Curation Study' }),
            createStudy({ name: 'Extra Study Not In Curation' }),
        ];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(true);
    });

    it('returns true when studyset is empty but curation has stubs', () => {
        const stubs = [createStub({ title: 'Study' })];
        const studies: StudyReturn[] = [];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(true);
    });

    it('returns true when curation is empty but studyset has studies', () => {
        const stubs: ICurationStubStudy[] = [];
        const studies = [createStudy({ name: 'Study' })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(true);
    });

    it('handles stubs and studies with undefined pmid and doi', () => {
        const stubs = [createStub({ title: 'Match', pmid: '', doi: '' })];
        const studies = [createStudy({ name: 'Match', pmid: undefined, doi: undefined })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(false);
    });

    it('matches when one item has pmid and the other has matching name', () => {
        const stubs = [createStub({ title: 'Study A', pmid: '111' })];
        const studies = [createStudy({ name: 'Study A' })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(false);
    });

    it('returns true when stub has only empty/undefined identifiers', () => {
        const stubs = [createStub({ title: '', pmid: '', doi: '' })];
        const studies = [createStudy({ name: 'Some Study' })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(true);
    });

    it('returns true when pmids differ and no other identifier matches', () => {
        const stubs = [createStub({ pmid: '11111111' })];
        const studies = [createStudy({ pmid: '22222222' })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(true);
    });

    it('returns true when dois differ and no other identifier matches', () => {
        const stubs = [createStub({ doi: '10.1111/aaa' })];
        const studies = [createStudy({ doi: '10.2222/bbb' })];

        expect(hasDifferenceBetweenStudysetAndCuration(stubs, studies)).toBe(true);
    });
});
