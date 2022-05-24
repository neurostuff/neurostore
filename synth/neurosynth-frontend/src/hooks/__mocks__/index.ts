import { mockConditions, mockStudy } from 'testing/mockData';
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
    createMetaAnalysis: jest.fn(),
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
};
