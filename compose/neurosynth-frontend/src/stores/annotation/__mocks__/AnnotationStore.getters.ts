import { vi } from 'vitest';
import { mockAnnotations } from 'testing/mockData';

const useAnnotationName = vi.fn().mockReturnValue('annotation-test-name');
const useAnnotationNotes = vi.fn().mockReturnValue(mockAnnotations()[0].notes);
const useGetAnnotationIsLoading = vi.fn().mockReturnValue(false);
const useUpdateAnnotationIsLoading = vi.fn().mockReturnValue(false);
const useAnnotationIsEdited = vi.fn().mockReturnValue(false);
const useAnnotationIsError = vi.fn().mockReturnValue(false);
const useAnnotationId = vi.fn().mockReturnValue('test-id');

export {
    useAnnotationName,
    useAnnotationNotes,
    useGetAnnotationIsLoading,
    useUpdateAnnotationIsLoading,
    useAnnotationIsEdited,
    useAnnotationIsError,
    useAnnotationId,
};
