import { act, renderHook } from '@testing-library/react-hooks';
import {
    useGetAnalysesByStudyId,
    useGetStudyNonNestedById,
    useGetUncategorizedImagesByStudyId,
    useUserCanEdit,
} from 'hooks';
import { useQueryClient } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Mock, vi } from 'vitest';
import useCloneStudy from './useCloneStudy';
import useEnsureWritableStudy from './useEnsureWritableStudy';

vi.mock('react-query');
vi.mock('react-router-dom');
vi.mock('hooks');
vi.mock('pages/StudyIBMA/hooks/useCloneStudy');

const projectId = 'project-id';
const studyId = 'study-old';

const analyses = [
    {
        id: 'analysis-old-1',
        name: 'Motor contrast',
        order: 1,
        images: [{ id: 'img-old-1', filename: 'a.nii' }],
    },
];

const uncategorizedImages = [{ id: 'uncat-old', filename: 'free.nii' }];

const clonedStudy = {
    id: 'study-new',
    analyses: [
        {
            id: 'analysis-new-1',
            name: 'Motor contrast',
            order: 1,
            images: [{ id: 'img-new-1', filename: 'a.nii' }],
        },
    ],
};

const clonedUncategorizedImages = [{ id: 'uncat-new', filename: 'free.nii' }];

describe('useEnsureWritableStudy', () => {
    const mockNavigate = vi.fn();
    const mockCloneStudy = vi.fn();
    const mockFetchQuery = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        (useParams as Mock).mockReturnValue({ projectId, studyId });
        (useNavigate as Mock).mockReturnValue(mockNavigate);
        (useQueryClient as Mock).mockReturnValue({
            invalidateQueries: vi.fn(),
            fetchQuery: mockFetchQuery.mockResolvedValue(clonedUncategorizedImages),
        });

        (useGetStudyNonNestedById as Mock).mockReturnValue({
            data: { id: studyId, user: 'owner-user' },
            isLoading: false,
        });
        (useGetAnalysesByStudyId as Mock).mockReturnValue({
            data: analyses,
            isLoading: false,
        });
        (useGetUncategorizedImagesByStudyId as Mock).mockReturnValue({
            data: uncategorizedImages,
            isLoading: false,
        });
        (useUserCanEdit as Mock).mockReturnValue(true);
        (useCloneStudy as Mock).mockReturnValue({
            cloneStudy: mockCloneStudy,
            isLoading: false,
        });
    });

    it('returns undefined when studyId or study is missing', async () => {
        (useGetStudyNonNestedById as Mock).mockReturnValue({ data: undefined, isLoading: false });
        const { result } = renderHook(() => useEnsureWritableStudy());

        let writableStudy: Awaited<ReturnType<typeof result.current.ensureWritableStudy>>;
        await act(async () => {
            writableStudy = await result.current.ensureWritableStudy();
        });

        expect(writableStudy!).toBeUndefined();
        expect(mockCloneStudy).not.toHaveBeenCalled();
    });

    it('returns identity idMap without cloning when the user owns the study', async () => {
        const { result } = renderHook(() => useEnsureWritableStudy());

        let writableStudy: Awaited<ReturnType<typeof result.current.ensureWritableStudy>>;
        await act(async () => {
            writableStudy = await result.current.ensureWritableStudy();
        });

        expect(writableStudy).toEqual({
            studyId,
            didClone: false,
            idMap: {
                oldAnalysisIdsToNewIdsMap: { 'analysis-old-1': 'analysis-old-1' },
                oldImageIdToNewIdMap: { 'img-old-1': 'img-old-1', 'uncat-old': 'uncat-old' },
            },
        });
        expect(mockCloneStudy).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('clones, navigates, and returns remapped ids when the user does not own the study', async () => {
        (useUserCanEdit as Mock).mockReturnValue(false);
        mockCloneStudy.mockResolvedValue(clonedStudy);

        const studyRequest = { name: 'Updated title' };
        const { result } = renderHook(() => useEnsureWritableStudy());

        let writableStudy: Awaited<ReturnType<typeof result.current.ensureWritableStudy>>;
        await act(async () => {
            writableStudy = await result.current.ensureWritableStudy({ studyRequest });
        });

        expect(mockCloneStudy).toHaveBeenCalledWith(studyRequest);
        expect(mockFetchQuery).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith(`/projects/${projectId}/extraction/studies/study-new/edit`);
        expect(writableStudy).toEqual({
            studyId: 'study-new',
            didClone: true,
            idMap: {
                oldAnalysisIdsToNewIdsMap: { 'analysis-old-1': 'analysis-new-1' },
                oldImageIdToNewIdMap: { 'img-old-1': 'img-new-1', 'uncat-old': 'uncat-new' },
            },
        });
    });

    it('returns undefined when cloneStudy does not produce a study id', async () => {
        (useUserCanEdit as Mock).mockReturnValue(false);
        mockCloneStudy.mockResolvedValue({ id: undefined, analyses: [] });

        const { result } = renderHook(() => useEnsureWritableStudy());

        let writableStudy: Awaited<ReturnType<typeof result.current.ensureWritableStudy>>;
        await act(async () => {
            writableStudy = await result.current.ensureWritableStudy();
        });

        expect(writableStudy!).toBeUndefined();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('exposes clone loading state from useCloneStudy', () => {
        (useCloneStudy as Mock).mockReturnValue({
            cloneStudy: mockCloneStudy,
            isLoading: true,
        });

        const { result } = renderHook(() => useEnsureWritableStudy());

        expect(result.current.isLoading).toBe(true);
    });
});
