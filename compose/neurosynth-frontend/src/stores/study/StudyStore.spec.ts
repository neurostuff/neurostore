import { act, renderHook } from '@testing-library/react';
import { useStudyAnalysisWarnings, useStudyStore } from 'stores/study/StudyStore';
import { getEmptyStudy, IStoreAnalysis, IStorePoint } from 'stores/study/StudyStore.helpers';

vi.mock('api/api.config');

const pointWarnings = { hasEmptyPoints: true, hasNonMNICoordinates: false, hasInvalidEntries: false };

const point = (overrides: Record<string, unknown>) =>
    ({ id: 'point-id', isNew: false, x: 10, y: 20, z: 30, ...overrides }) as IStorePoint;

const analysis = (id: string, name: string, points: IStorePoint[] = [point({})]): IStoreAnalysis => ({
    id,
    name,
    description: '',
    isNew: false,
    conditions: [],
    points,
    pointSpace: undefined,
    pointStatistic: undefined,
});

const setAnalyses = (analyses: IStoreAnalysis[]) => {
    useStudyStore.setState((state) => ({ study: { ...state.study, ...getEmptyStudy(), analyses } }));
};

const renderWarnings = (analysisId?: string) => renderHook(() => useStudyAnalysisWarnings(analysisId)).result;

describe('StudyStore point warnings', () => {
    beforeEach(() => {
        useStudyStore.getState().clearStudyStore();
    });

    it('sets and removes the point warnings for an analysis', () => {
        useStudyStore.getState().setAnalysisPointWarnings('analysis-1', pointWarnings);
        expect(useStudyStore.getState().storeMetadata.validation).toEqual({
            'analysis-1': pointWarnings,
        });

        useStudyStore.getState().setAnalysisPointWarnings('analysis-1');
        expect(useStudyStore.getState().storeMetadata.validation).toEqual({});
    });

    it('clears the point warnings with the rest of the store', () => {
        useStudyStore.getState().setAnalysisPointWarnings('analysis-1', pointWarnings);
        useStudyStore.getState().clearStudyStore();
        expect(useStudyStore.getState().storeMetadata.validation).toEqual({});
    });

    it('clears the point warnings when a study is loaded', async () => {
        useStudyStore.getState().setAnalysisPointWarnings('analysis-1', pointWarnings);
        await useStudyStore.getState().initStudyStore('study-id');
        expect(useStudyStore.getState().storeMetadata.validation).toEqual({});
    });
});

describe('useStudyAnalysisWarnings', () => {
    beforeEach(() => {
        useStudyStore.getState().clearStudyStore();
    });

    it('returns no warnings for a named analysis with valid points', () => {
        setAnalyses([analysis('analysis-1', 'Analysis 1'), analysis('analysis-2', 'Analysis 2')]);
        expect(renderWarnings('analysis-1').current).toEqual({
            hasNoName: false,
            hasDuplicateName: false,
            hasEmptyPoints: false,
            hasNonMNICoordinates: false,
            hasInvalidEntries: false,
        });
    });

    it('flags a missing name and a name another analysis already uses', () => {
        setAnalyses([analysis('analysis-1', ''), analysis('analysis-2', 'Same'), analysis('analysis-3', 'Same')]);
        expect(renderWarnings('analysis-1').current.hasNoName).toBe(true);
        expect(renderWarnings('analysis-2').current.hasDuplicateName).toBe(true);
    });

    it.each([
        ['an empty', { x: undefined, y: undefined, z: undefined }],
        ['a partly filled', { x: 10, y: undefined, z: 30 }],
    ])('flags %s row as an empty point', (_label, coordinates) => {
        setAnalyses([analysis('analysis-1', 'Analysis 1', [point({}), point(coordinates)])]);
        expect(renderWarnings('analysis-1').current.hasEmptyPoints).toBe(true);
    });

    it('does not flag a blank text row as an empty point', () => {
        setAnalyses([analysis('analysis-1', 'Analysis 1', [point({}), point({ x: ' ', y: 0, z: 0 })])]);
        expect(renderWarnings('analysis-1').current.hasEmptyPoints).toBe(false);
    });

    it('does not flag empty points when there are no rows', () => {
        setAnalyses([analysis('analysis-1', 'Analysis 1', [])]);
        expect(renderWarnings('analysis-1').current.hasEmptyPoints).toBe(false);
    });

    it('flags a point outside MNI bounds', () => {
        setAnalyses([analysis('analysis-1', 'Analysis 1', [point({ x: 100, y: 0, z: 0 })])]);
        expect(renderWarnings('analysis-1').current.hasNonMNICoordinates).toBe(true);
    });

    it('reports a non-numeric coordinate as an invalid entry, not as non MNI or empty', () => {
        setAnalyses([analysis('analysis-1', 'Analysis 1', [point({ x: 'left', y: 0, z: 0 })])]);
        expect(renderWarnings('analysis-1').current).toMatchObject({
            hasInvalidEntries: true,
            hasNonMNICoordinates: false,
            hasEmptyPoints: false,
        });
    });

    it('flags a non-boolean subpeak as an invalid entry', () => {
        setAnalyses([analysis('analysis-1', 'Analysis 1', [point({ subpeak: 'yes' })])]);
        expect(renderWarnings('analysis-1').current.hasInvalidEntries).toBe(true);
    });

    it('uses the coordinates table point warnings over the stored points', () => {
        setAnalyses([analysis('analysis-1', 'Analysis 1', [point({ x: 100, y: 0, z: 0 })])]);
        useStudyStore.getState().setAnalysisPointWarnings('analysis-1', pointWarnings);
        expect(renderWarnings('analysis-1').current).toMatchObject(pointWarnings);
    });

    it('updates when the table warnings change and keeps the same object otherwise', () => {
        setAnalyses([analysis('analysis-1', 'Analysis 1')]);
        const result = renderWarnings('analysis-1');
        const first = result.current;

        act(() => useStudyStore.getState().markStudyEdited());
        expect(result.current).toBe(first);

        act(() => useStudyStore.getState().setAnalysisPointWarnings('analysis-1', pointWarnings));
        expect(result.current.hasEmptyPoints).toBe(true);
    });
});
