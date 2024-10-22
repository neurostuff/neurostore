import { mockAnnotations } from 'testing/mockData';

const useAnnotationName = jest.fn().mockReturnValue('annotation-test-name');
const useAnnotationNotes = jest.fn().mockReturnValue(mockAnnotations()[0].notes);
const useGetAnnotationIsLoading = jest.fn().mockReturnValue(false);
const useUpdateAnnotationIsLoading = jest.fn().mockReturnValue(false);
const useAnnotationIsEdited = jest.fn().mockReturnValue(false);
const useAnnotationIsError = jest.fn().mockReturnValue(false);
const useAnnotationId = jest.fn().mockReturnValue('test-id');

export {
    useAnnotationName,
    useAnnotationNotes,
    useGetAnnotationIsLoading,
    useUpdateAnnotationIsLoading,
    useAnnotationIsEdited,
    useAnnotationIsError,
    useAnnotationId,
};
