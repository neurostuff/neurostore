import { vi } from 'vitest';
import useInputValidation from 'hooks/useInputValidation'; // don't need to mock this as it isn't making any api calls
import {
    mockAnnotations,
    mockBaseStudy,
    mockMetaAnalysisResult,
    mockMetaAnalysisReturn,
    mockNeurovault,
    mockProject,
    mockStudy,
    mockStudysetNested,
    mockStudysetNotNested,
    mockStudysets,
} from 'testing/mockData';

const useUpdateAnalysis = vi.fn().mockReturnValue({
    isPending: false,
    isError: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
});

const useDeleteAnalysis = vi.fn().mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
});

const useCreatePoint = vi.fn().mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
});

const useUpdatePoint = vi.fn().mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
});

const useDeletePoint = vi.fn().mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
});

const studyByIdMockReturn = {
    isLoading: false,
    data: mockStudy(),
};

const useGetStudyNonNestedById = vi.fn().mockReturnValue(studyByIdMockReturn);

const useCreateAnalysis = vi.fn().mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'analysis-new' } }),
});

const useUpdateImage = vi.fn().mockReturnValue({
    isLoading: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
});

const useUpdateAnnotationByAnnotationAndAnalysisIds = vi.fn().mockReturnValue({
    isLoading: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
});

const useCreateMetaAnalysis = vi.fn().mockReturnValue({
    error: undefined,
    isPending: false,
    isError: false,
    createMetaAnalysis: vi.fn().mockReturnValue(Promise.resolve()),
});

const useCreateStudyset = vi.fn().mockReturnValue({
    // isPending: false,
    // isError: false,
    // mutate: vi.fn(),
    isPending: false,
    isError: false,
    mutate: vi.fn(),
});

const useUpdateStudyset = vi.fn().mockReturnValue({
    isPending: false,
    isError: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockReturnValue(mockStudysets()),
});

const useUpdateStudy = vi.fn().mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
});

const useGetAnalysesByStudyId = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: [],
});

const useGetAnnotationById = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: mockAnnotations()[0],
});

const useCreateProject = vi.fn().mockReturnValue({
    isPending: false,
    isError: false,
    mutate: vi.fn(),
});

const useDeleteProject = vi.fn().mockReturnValue({
    isPending: false,
    isError: false,
    mutate: vi.fn(),
});

const useGetExtractionSummary = vi.fn().mockReturnValue({
    savedForLater: 0,
    unreviewed: 0,
    completed: 0,
    total: 0,
});

// need to do this to prevent an infinite loop
const studysetNested = mockStudysetNested();
const studysetNotNested = mockStudysetNotNested();
const useGetStudysetById = vi.fn().mockImplementation((studysetId: string, isNested: boolean, summary: boolean) => {
    return {
        isLoading: false,
        isError: false,
        data: isNested ? studysetNested : studysetNotNested,
    };
});
const useGetStudysetNonNestedById = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: studysetNotNested,
});
const useGetStudysetSummaryById = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: studysetNested,
});

const baseStudyByIdMockReturn = {
    isLoading: false,
    isError: false,
    data: mockBaseStudy(),
};

const useGetBaseStudyFlatById = vi.fn().mockReturnValue(baseStudyByIdMockReturn);
const useGetBaseStudyInfoById = vi.fn().mockReturnValue(baseStudyByIdMockReturn);
const useGetBaseStudyNestedById = vi.fn().mockReturnValue(baseStudyByIdMockReturn);
const useGetBaseStudyNonNestedById = vi.fn().mockReturnValue(baseStudyByIdMockReturn);

const useGetFullText = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: '',
});

const useCreateStudy = vi.fn().mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockReturnValue({
        data: mockStudy(),
    }),
});

const useUpdateAnnotationById = vi.fn().mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
});

const useGetProjectById = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: mockProject(),
});

const useIsMounted = () => {
    return {
        __esModule: true,
        default: {
            current: true,
        },
        current: true,
    };
};

const useUserCanEdit = vi.fn().mockReturnValue(true);

const useGetMetaAnalysisResultById = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: mockMetaAnalysisResult(),
});

const useGetMetaAnalysisById = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: mockMetaAnalysisReturn(),
});

const useGetNeurovaultImages = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: mockNeurovault(),
});

export {
    useCreateAnalysis,
    useUpdateImage,
    useUpdateAnnotationByAnnotationAndAnalysisIds,
    useCreateMetaAnalysis,
    useCreatePoint,
    useCreateProject,
    useCreateStudy,
    useCreateStudyset,
    useDeleteAnalysis,
    useDeletePoint,
    useDeleteProject,
    useGetAnnotationById,
    useGetAnalysesByStudyId,
    useGetBaseStudyFlatById,
    useGetBaseStudyInfoById,
    useGetBaseStudyNestedById,
    useGetBaseStudyNonNestedById,
    useGetExtractionSummary,
    useGetFullText,
    useGetStudyNonNestedById,
    useGetStudysetById,
    useGetStudysetNonNestedById,
    useGetStudysetSummaryById,
    useInputValidation,
    useIsMounted,
    useUpdateAnalysis,
    useUpdateAnnotationById,
    useUpdatePoint,
    useUpdateStudy,
    useUpdateStudyset,
    useUserCanEdit,
    useGetProjectById,
    useGetMetaAnalysisById,
    useGetMetaAnalysisResultById,
    useGetNeurovaultImages,
};
