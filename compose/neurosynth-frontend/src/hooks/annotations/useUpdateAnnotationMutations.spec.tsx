import React from 'react';
import { act, renderHook } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from 'react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useUpdateAnnotationByAnnotationAndAnalysisId from './useUpdateAnnotationByAnnotationAndAnalysisId';
import useUpdateAnnotationById from './useUpdateAnnotationById';

const mocks = vi.hoisted(() => ({
    annotationAnalysesPost: vi.fn(),
    annotationsIdPut: vi.fn(),
    enqueueSnackbar: vi.fn(),
}));

vi.mock('api/api.config', () => ({
    default: {
        NeurostoreServices: {
            AnalysesService: {
                annotationAnalysesPost: mocks.annotationAnalysesPost,
            },
            AnnotationsService: {
                annotationsIdPut: mocks.annotationsIdPut,
            },
        },
    },
}));

vi.mock('notistack', () => ({
    useSnackbar: () => ({
        enqueueSnackbar: mocks.enqueueSnackbar,
    }),
}));

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    const invalidateQueriesSpy = vi
        .spyOn(queryClient, 'invalidateQueries')
        .mockResolvedValue(undefined as never);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return {
        invalidateQueriesSpy,
        queryClient,
        wrapper,
    };
};

describe('annotation update hooks', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('invalidates the annotation query after annotation updates by default', async () => {
        mocks.annotationsIdPut.mockResolvedValue({ data: {} });
        const { invalidateQueriesSpy, queryClient, wrapper } = createWrapper();

        const { result } = renderHook(() => useUpdateAnnotationById('annotation-id'), {
            wrapper,
        });

        await act(async () => {
            await result.current.mutateAsync({
                argAnnotationId: 'annotation-id',
                annotation: { note_keys: {} },
            });
        });

        expect(mocks.annotationsIdPut).toHaveBeenCalledWith('annotation-id', {
            note_keys: {},
        });
        expect(invalidateQueriesSpy).toHaveBeenCalledWith([
            'annotations',
            'annotation-id',
        ]);

        queryClient.clear();
    });

    it('can skip invalidation for annotation updates', async () => {
        mocks.annotationsIdPut.mockResolvedValue({ data: {} });
        const { invalidateQueriesSpy, queryClient, wrapper } = createWrapper();

        const { result } = renderHook(
            () =>
                useUpdateAnnotationById('annotation-id', {
                    invalidateOnSuccess: false,
                }),
            { wrapper }
        );

        await act(async () => {
            await result.current.mutateAsync({
                argAnnotationId: 'annotation-id',
                annotation: { note_keys: {} },
            });
        });

        expect(invalidateQueriesSpy).not.toHaveBeenCalled();

        queryClient.clear();
    });

    it('can skip invalidation for annotation-analysis updates', async () => {
        mocks.annotationAnalysesPost.mockResolvedValue({ data: [] });
        const { invalidateQueriesSpy, queryClient, wrapper } = createWrapper();

        const { result } = renderHook(
            () =>
                useUpdateAnnotationByAnnotationAndAnalysisId('annotation-id', {
                    invalidateOnSuccess: false,
                }),
            { wrapper }
        );

        await act(async () => {
            await result.current.mutateAsync([
                {
                    id: 'annotation-id_analysis-id',
                    note: { included: true },
                },
            ]);
        });

        expect(mocks.annotationAnalysesPost).toHaveBeenCalledWith([
            {
                id: 'annotation-id_analysis-id',
                note: { included: true },
            },
        ]);
        expect(invalidateQueriesSpy).not.toHaveBeenCalled();

        queryClient.clear();
    });
});
