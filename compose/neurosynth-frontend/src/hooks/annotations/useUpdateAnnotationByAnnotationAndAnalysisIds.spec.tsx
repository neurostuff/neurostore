import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import API from 'api/api.config';
import annotationQueries from 'hooks/annotations/annotationQueries';
import type { AnnotationReturnOneOfWithNoteCollection } from 'hooks/annotations/annotationQueries.types';
import useUpdateAnnotationByAnnotationAndAnalysisIds from 'hooks/annotations/useUpdateAnnotationByAnnotationAndAnalysisIds';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() }),
}));

const annotationId = 'annotation-1';

const existingAnnotation: AnnotationReturnOneOfWithNoteCollection = {
    id: annotationId,
    notes: [
        {
            id: 'note-1',
            analysis: 'analysis-1',
            note: { included: false },
        },
        {
            id: 'note-2',
            analysis: 'analysis-2',
            note: { included: true },
        },
    ],
};

describe('useUpdateAnnotationByAnnotationAndAnalysisIds', () => {
    let queryClient: QueryClient;

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
    });

    it('merges returned notes into the cached annotation when present', async () => {
        queryClient.setQueryData(annotationQueries.byId(annotationId).queryKey, existingAnnotation);

        vi.spyOn(API.NeurostoreServices.AnalysesService, 'annotationAnalysesPost').mockResolvedValue({
            data: [
                {
                    id: 'note-1',
                    analysis: 'analysis-1',
                    note: { included: true },
                },
            ],
        } as never);

        const { result } = renderHook(() => useUpdateAnnotationByAnnotationAndAnalysisIds(annotationId), {
            wrapper,
        });

        await act(async () => {
            await result.current.mutateAsync([
                {
                    id: `${annotationId}_analysis-1`,
                    note: { included: true },
                },
            ]);
        });

        await waitFor(() => {
            const cached = queryClient.getQueryData<AnnotationReturnOneOfWithNoteCollection>(
                annotationQueries.byId(annotationId).queryKey
            );
            expect(cached?.notes).toEqual([
                {
                    id: 'note-1',
                    analysis: 'analysis-1',
                    note: { included: true },
                },
                {
                    id: 'note-2',
                    analysis: 'analysis-2',
                    note: { included: true },
                },
            ]);
        });
    });

    it('does not create annotation cache data when none exists', async () => {
        vi.spyOn(API.NeurostoreServices.AnalysesService, 'annotationAnalysesPost').mockResolvedValue({
            data: [
                {
                    id: 'note-1',
                    analysis: 'analysis-1',
                    note: { included: true },
                },
            ],
        } as never);

        const { result } = renderHook(() => useUpdateAnnotationByAnnotationAndAnalysisIds(annotationId), {
            wrapper,
        });

        await act(async () => {
            await result.current.mutateAsync([
                {
                    id: `${annotationId}_analysis-1`,
                    note: { included: true },
                },
            ]);
        });

        expect(queryClient.getQueryData(annotationQueries.byId(annotationId).queryKey)).toBeUndefined();
    });
});
