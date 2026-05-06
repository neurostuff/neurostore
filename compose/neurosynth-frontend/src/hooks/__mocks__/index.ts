import { vi } from 'vitest';
import useInputValidation from 'hooks/useInputValidation'; // don't need to mock this as it isn't making any api calls
import {
    mockAnnotations,
    mockBaseStudy,
    mockConditions,
    mockMetaAnalysisResult,
    mockNeurovault,
    mockProject,
    mockStudy,
    mockStudysetNested,
    mockStudysetNotNested,
    mockStudysets,
} from 'testing/mockData';

const useUpdateAnalysis = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    mutate: vi.fn(),
});

const useDeleteAnalysis = vi.fn().mockReturnValue({
    isLoading: false,
    mutate: vi.fn(),
});

const useCreateCondition = vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isLoading: false,
});

const useGetConditions = vi.fn().mockReturnValue({
    isLoading: false,
    data: mockConditions(),
    isError: false,
});

const useCreatePoint = vi.fn().mockReturnValue({
    isLoading: false,
    mutate: vi.fn(),
});

const useUpdatePoint = vi.fn().mockReturnValue({
    isLoading: false,
    mutate: vi.fn(),
});

const useDeletePoint = vi.fn().mockReturnValue({
    isLoading: false,
    mutate: vi.fn(),
});

const studyByIdMockReturn = {
    isLoading: false,
    data: mockStudy(),
};

const useGetStudyNestedById = vi.fn().mockReturnValue(studyByIdMockReturn);

const useGetStudyNonNestedById = vi.fn().mockReturnValue(studyByIdMockReturn);

const useCreateAnalysis = vi.fn().mockReturnValue({
    isLoading: false,
    mutate: vi.fn(),
});

const useCreateMetaAnalysis = vi.fn().mockReturnValue({
    error: undefined,
    isLoading: false,
    isError: false,
    createMetaAnalysis: vi.fn().mockReturnValue(Promise.resolve()),
});

const useCreateStudyset = vi.fn().mockReturnValue({
    // isLoading: false,
    // isError: false,
    // mutate: vi.fn(),
    isLoading: false,
    isError: false,
    mutate: vi.fn(),
});

const useUpdateStudyset = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockReturnValue(mockStudysets()),
});

const useUpdateStudy = vi.fn().mockReturnValue({
    isLoading: false,
    mutate: vi.fn(),
});

const useGetAnnotationsByStudysetId = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: mockAnnotations(),
});

const useCreateProject = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    mutate: vi.fn(),
});

const useDeleteProject = vi.fn().mockReturnValue({
    isLoading: false,
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
const useGetStudysetNestedById = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: studysetNested,
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
    isLoading: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockReturnValue({
        data: mockStudy(),
    }),
});

const useUpdateAnnotationById = vi.fn().mockReturnValue({
    isLoading: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
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

const useGetNeurovaultImages = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: mockNeurovault(),
});

export {
    useCreateAnalysis,
    useCreateCondition,
    useCreateMetaAnalysis,
    useCreatePoint,
    useCreateProject,
    useCreateStudy,
    useCreateStudyset,
    useDeleteAnalysis,
    useDeletePoint,
    useDeleteProject,
    useGetAnnotationsByStudysetId,
    useGetBaseStudyFlatById,
    useGetBaseStudyInfoById,
    useGetBaseStudyNestedById,
    useGetBaseStudyNonNestedById,
    useGetConditions,
    useGetExtractionSummary,
    useGetFullText,
    useGetStudyNestedById,
    useGetStudyNonNestedById,
    useGetStudysetById,
    useGetStudysetNonNestedById,
    useGetStudysetNestedById,
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
    useGetMetaAnalysisResultById,
    useGetNeurovaultImages,
};
