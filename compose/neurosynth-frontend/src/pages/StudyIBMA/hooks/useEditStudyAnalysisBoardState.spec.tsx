import { act, renderHook } from '@testing-library/react-hooks';
import { useGetAnalysesByStudyId, useGetAnnotationById, useGetUncategorizedImagesByStudyId } from 'hooks';
import useIbmaBoardMutations from 'pages/StudyIBMA/hooks/useIbmaBoardMutations';
import { useProjectExtractionAnnotationId } from 'stores/projects/ProjectStore';
import { useParams } from 'react-router-dom';
import { Mock, vi } from 'vitest';
import useEditStudyAnalysisBoardState from './useEditStudyAnalysisBoardState';

vi.mock('hooks');
vi.mock('react-router-dom');
vi.mock('stores/projects/ProjectStore');
vi.mock('pages/StudyIBMA/hooks/useIbmaBoardMutations', () => ({
    default: vi.fn(),
}));

const studyId = 'study-1';
const annotationId = 'annotation-1';

const analyses = [
    {
        id: 'analysis-2',
        name: 'Contrast B',
        order: 2,
        images: [{ id: 'img-b', filename: 'b.nii' }],
    },
    {
        id: 'analysis-1',
        name: 'Contrast A',
        order: 1,
        images: [
            { id: 'img-z', filename: 'z.nii' },
            { id: 'img-a', filename: 'a.nii' },
        ],
    },
];

const annotation = {
    id: annotationId,
    note_keys: {
        included: { type: 'boolean', order: 0 },
    },
    notes: [
        {
            analysis: 'analysis-1',
            study: studyId,
            note: { included: true },
        },
    ],
};

const uncategorizedImages = [{ id: 'orphan-image', filename: 'orphan.nii' }];

describe('useEditStudyAnalysisBoardState', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        (useParams as Mock).mockReturnValue({ studyId });
        (useProjectExtractionAnnotationId as Mock).mockReturnValue(annotationId);
        (useGetAnalysesByStudyId as Mock).mockReturnValue({
            data: analyses,
            isLoading: false,
        });
        (useGetUncategorizedImagesByStudyId as Mock).mockReturnValue({
            data: uncategorizedImages,
            isLoading: false,
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            data: annotation,
            isLoading: false,
        });
        (useIbmaBoardMutations as Mock).mockReturnValue({
            createAnalysis: vi.fn(),
            updateAnalysis: vi.fn(),
            deleteAnalysis: vi.fn(),
            addAnnotationColumn: vi.fn(),
            removeAnnotationColumn: vi.fn(),
            updateAnnotationCell: vi.fn(),
            updateImage: vi.fn(),
            isPending: false,
        });
    });

    it('sorts analyses by order and merges annotation values into table rows', () => {
        const { result } = renderHook(() => useEditStudyAnalysisBoardState());

        const rows = result.current.table.getRowModel().rows;
        expect(rows).toHaveLength(2);
        expect(rows[0]?.original.id).toBe('analysis-1');
        expect(rows[1]?.original.id).toBe('analysis-2');
        expect(rows[0]?.original.analysisAnnotation.included).toBe(true);
        expect(rows[1]?.original.analysisAnnotation.included).toBe(null);
        expect(rows[0]?.original.images?.map((image) => image.id)).toEqual(['img-a', 'img-z']);
    });

    it('exposes uncategorized images and note keys from query data', () => {
        const { result } = renderHook(() => useEditStudyAnalysisBoardState());

        expect(result.current.uncategorized).toEqual(uncategorizedImages);
        expect(result.current.noteKeys).toEqual([{ key: 'included', type: 'boolean', order: 0, default: null }]);
    });

    it('wires mutation handlers through table meta', () => {
        const mutations = {
            createAnalysis: vi.fn(),
            updateAnalysis: vi.fn(),
            deleteAnalysis: vi.fn(),
            addAnnotationColumn: vi.fn(),
            removeAnnotationColumn: vi.fn(),
            updateAnnotationCell: vi.fn(),
            updateImage: vi.fn(),
            isPending: false,
        };
        (useIbmaBoardMutations as Mock).mockReturnValue(mutations);

        const { result } = renderHook(() => useEditStudyAnalysisBoardState());
        const tableMeta = result.current.table.options.meta;

        expect(tableMeta?.createAnalysis).toBe(mutations.createAnalysis);
        expect(tableMeta?.updateAnalysis).toBe(mutations.updateAnalysis);
        expect(tableMeta?.deleteAnalysis).toBe(mutations.deleteAnalysis);
        expect(tableMeta?.addAnnotationColumn).toBe(mutations.addAnnotationColumn);
        expect(tableMeta?.updateAnnotationCell).toBe(mutations.updateAnnotationCell);
        expect(tableMeta?.updateImage).toBe(mutations.updateImage);
        expect(tableMeta?.analyses).toEqual(analyses);
    });

    it('toggles selectedImageId through table meta', () => {
        const { result } = renderHook(() => useEditStudyAnalysisBoardState());

        act(() => {
            result.current.table.options.meta?.toggleImageSelection?.('img-a');
        });

        expect(result.current.table.options.meta?.selectedImageId).toBe('img-a');

        act(() => {
            result.current.table.options.meta?.toggleImageSelection?.('img-a');
        });

        expect(result.current.table.options.meta?.selectedImageId).toBe(null);
    });

    it('reports loading while analyses, annotation, or uncategorized images are fetching', () => {
        (useGetAnalysesByStudyId as Mock).mockReturnValue({
            data: analyses,
            isLoading: true,
        });

        const { result } = renderHook(() => useEditStudyAnalysisBoardState());

        expect(result.current.isLoading).toBe(true);
    });
});
