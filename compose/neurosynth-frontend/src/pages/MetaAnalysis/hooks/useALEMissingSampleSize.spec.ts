import { vi, Mock } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import { useGetAnnotationById, useGetStudysetById } from 'hooks';
import { useProjectExtractionAnnotationId, useProjectExtractionStudysetId } from 'pages/Project/store/ProjectStore';
import useStudiesWithMissingSampleSizeALE from './useALEMissingSampleSize';

vi.mock('hooks', () => ({
    useGetStudysetById: vi.fn(),
    useGetAnnotationById: vi.fn(),
}));

vi.mock('pages/Project/store/ProjectStore', () => ({
    useProjectExtractionStudysetId: vi.fn(),
    useProjectExtractionAnnotationId: vi.fn(),
}));

describe('useStudiesWithMissingSampleSizeALE', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useProjectExtractionStudysetId as Mock).mockReturnValue('studyset-1');
        (useProjectExtractionAnnotationId as Mock).mockReturnValue('annotation-1');
        (useGetStudysetById as Mock).mockReturnValue({ data: undefined });
        (useGetAnnotationById as Mock).mockReturnValue({ data: undefined });
    });

    it('returns empty array when algorithm is not ALE', () => {
        (useGetStudysetById as Mock).mockReturnValue({
            data: {
                studies: [{ id: 'study-1', name: 'Study 1', metadata: null }],
            },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: { notes: [] },
        });

        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE('MKDA'));
        expect(result.current).toEqual([]);
    });

    it('returns empty array when algorithm is undefined', () => {
        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE(undefined));
        expect(result.current).toEqual([]);
    });

    it('returns empty array when studyset has no studies', () => {
        (useGetStudysetById as Mock).mockReturnValue({
            data: { studies: [] },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: { notes: [] },
        });

        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE('ALE'));
        expect(result.current).toEqual([]);
    });

    it('returns empty array when annotation has no notes', () => {
        (useGetStudysetById as Mock).mockReturnValue({
            data: {
                studies: [{ id: 'study-1', name: 'Study 1', metadata: null }],
            },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: { notes: undefined },
        });

        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE('ALE'));
        expect(result.current).toEqual([]);
    });

    it('returns studies missing sample size when ALE and no notes or metadata have sample_size', () => {
        (useGetStudysetById as Mock).mockReturnValue({
            data: {
                studies: [
                    { id: 'study-1', name: 'Study One', metadata: null },
                    { id: 'study-2', name: 'Study Two', metadata: {} },
                ],
            },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: {
                notes: [
                    { study: 'study-1', note: {} },
                    { study: 'study-2', note: { sample_size: 'not a number' } },
                ],
            },
        });

        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE('ALE'));
        expect(result.current).toHaveLength(2);
        expect(result.current).toContainEqual({ studyId: 'study-1', studyName: 'Study One' });
        expect(result.current).toContainEqual({ studyId: 'study-2', studyName: 'Study Two' });
    });

    it('excludes study when annotation notes for that study have sample_size', () => {
        (useGetStudysetById as Mock).mockReturnValue({
            data: {
                studies: [
                    { id: 'study-1', name: 'Study One', metadata: null },
                    { id: 'study-2', name: 'Study Two', metadata: null },
                ],
            },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: {
                notes: [
                    { study: 'study-1', note: {} },
                    { study: 'study-2', note: { sample_size: 20 } },
                ],
            },
        });

        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE('ALE'));
        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toEqual({ studyId: 'study-1', studyName: 'Study One' });
    });

    it('excludes study when study metadata has sample_size', () => {
        (useGetStudysetById as Mock).mockReturnValue({
            data: {
                studies: [
                    { id: 'study-1', name: 'Study One', metadata: { sample_size: 15 } },
                ],
            },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: { notes: [] },
        });

        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE('ALE'));
        expect(result.current).toEqual([]);
    });

    it('includes study when only some notes for that study have sample_size', () => {
        (useGetStudysetById as Mock).mockReturnValue({
            data: {
                studies: [{ id: 'study-1', name: 'Study One', metadata: null }],
            },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: {
                notes: [
                    { study: 'study-1', note: { sample_size: 10 } },
                    { study: 'study-1', note: {} },
                ],
            },
        });

        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE('ALE'));
        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toEqual({ studyId: 'study-1', studyName: 'Study One' });
    });

    it('handles studies as string ids', () => {
        (useGetStudysetById as Mock).mockReturnValue({
            data: {
                studies: ['study-1', 'study-2'],
            },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: { notes: [] },
        });

        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE('ALE'));
        expect(result.current).toHaveLength(2);
        expect(result.current).toContainEqual({ studyId: 'study-1', studyName: null });
        expect(result.current).toContainEqual({ studyId: 'study-2', studyName: null });
    });

    it('skips study when studyId is falsy', () => {
        (useGetStudysetById as Mock).mockReturnValue({
            data: {
                studies: [
                    { id: '', name: 'Empty', metadata: null },
                    { id: 'study-1', name: 'Valid', metadata: null },
                ],
            },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: { notes: [] },
        });

        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE('ALE'));
        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toEqual({ studyId: 'study-1', studyName: 'Valid' });
    });

    it('does not treat sample_size 0 as missing (valid number)', () => {
        (useGetStudysetById as Mock).mockReturnValue({
            data: {
                studies: [{ id: 'study-1', name: 'Study One', metadata: null }],
            },
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: {
                notes: [{ study: 'study-1', note: { sample_size: 0 } }],
            },
        });

        const { result } = renderHook(() => useStudiesWithMissingSampleSizeALE('ALE'));
        expect(result.current).toEqual([]);
    });
});
