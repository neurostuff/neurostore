import {
    mockAnnotations,
    mockConditions,
    mockStudy,
    mockStudysetNested,
    mockStudysets,
} from 'testing/mockData';
import useInputValidation from 'hooks/useInputValidation'; // don't need to mock this as it isn't making any api calls

const useUpdateAnalysis = jest.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
});

const useDeleteAnalysis = jest.fn().mockReturnValue({
    isLoading: false,
    mutate: jest.fn(),
});

const useCreateCondition = jest.fn().mockReturnValue({
    mutate: jest.fn(),
    isLoading: false,
});

const useGetConditions = jest.fn().mockReturnValue({
    isLoading: false,
    data: mockConditions(),
    isError: false,
});

const useCreatePoint = jest.fn().mockReturnValue({
    isLoading: false,
    mutate: jest.fn(),
});

const useUpdatePoint = jest.fn().mockReturnValue({
    isLoading: false,
    mutate: jest.fn(),
});

const useDeletePoint = jest.fn().mockReturnValue({
    isLoading: false,
    mutate: jest.fn(),
});

const useGetStudyById = jest.fn().mockReturnValue({
    isLoading: false,
    data: mockStudy(),
});

const useCreateAnalysis = jest.fn().mockReturnValue({
    isLoading: false,
    mutate: jest.fn(),
});

const useCreateMetaAnalysis = jest.fn().mockReturnValue({
    error: undefined,
    isLoading: false,
    isError: false,
    createMetaAnalysis: jest.fn().mockReturnValue(Promise.resolve()),
});

const useGetStudysets = jest.fn().mockReturnValue({
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

const useCreateStudyset = jest.fn().mockReturnValue({
    // isLoading: false,
    // isError: false,
    // mutate: jest.fn(),
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
});

const useUpdateStudyset = jest.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
});

const useUpdateStudy = jest.fn().mockReturnValue({
    isLoading: false,
    mutate: jest.fn(),
});

const useGetAnnotationsByStudysetId = jest.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: mockAnnotations(),
});

const useCreateProject = jest.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
});

const useDeleteProject = jest.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
});

const useGetExtractionSummary = jest.fn().mockReturnValue({
    savedForLater: 0,
    uncategorized: 0,
    completed: 0,
    total: 0,
});

const useGetStudysetById = jest.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: mockStudysetNested(),
});

const useGetFullText = jest.fn().mockReturnValue({
    isLoading: false,
    isError: false,
    data: '',
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

const useUserCanEdit = jest.fn().mockReturnValue(true);

export {
    useCreateMetaAnalysis,
    useDeleteAnalysis,
    useUpdateAnalysis,
    useCreateCondition,
    useGetConditions,
    useGetStudyById,
    useCreatePoint,
    useUpdatePoint,
    useDeletePoint,
    useCreateAnalysis,
    useInputValidation,
    useIsMounted,
    useUpdateStudyset,
    useCreateStudyset,
    useGetStudysets,
    useUpdateStudy,
    useGetAnnotationsByStudysetId,
    useCreateProject,
    useDeleteProject,
    useGetExtractionSummary,
    useGetStudysetById,
    useGetFullText,
    useUserCanEdit,
};
