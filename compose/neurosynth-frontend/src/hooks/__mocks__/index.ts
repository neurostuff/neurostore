import { vi } from 'vitest';
import useInputValidation from 'hooks/useInputValidation'; // don't need to mock this as it isn't making any api calls
import {
    mockAnnotations,
    mockBaseStudy,
    mockConditions,
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

const useGetStudyById = vi.fn().mockReturnValue({
    isLoading: false,
    data: mockStudy(),
});

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

const useGetStudysets = vi.fn().mockReturnValue({
    error: undefined,
    isLoading: false,
    isError: false,
    data: {
        metadata: {
            total_count: 100,
            unique_count: 100,
        },
        results: mockStudysets(),
    },
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
    uncategorized: 0,
    completed: 0,
    total: 0,
});

// need to do this to prevent an infinite loop
const studysetNested = mockStudysetNested();
const studysetNotNested = mockStudysetNotNested();
const useGetStudysetById = vi.fn().mockImplementation((studysetId: string, isNested: boolean) => {
    return {
        isLoading: false,
        isError: false,
        data: isNested ? studysetNested : studysetNotNested,
    };
});

const useGetBaseStudyById = vi.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: mockBaseStudy(),
});

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
    useGetBaseStudyById,
    useGetConditions,
    useGetExtractionSummary,
    useGetFullText,
    useGetStudyById,
    useGetStudysetById,
    useGetStudysets,
    useInputValidation,
    useIsMounted,
    useUpdateAnalysis,
    useUpdateAnnotationById,
    useUpdatePoint,
    useUpdateStudy,
    useUpdateStudyset,
    useUserCanEdit,
    useGetProjectById,
};
