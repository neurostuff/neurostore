import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';
import { AxiosError, AxiosResponse } from 'axios';
import annotationQueries from 'hooks/annotations/annotationQueries';
import { NoteCollectionRequest, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';

const useUpdateAnnotationByAnnotationAndAnalysisIds = (
    annotationId: string | undefined | null,
    options?: { invalidateOnSuccess?: boolean }
) => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<AxiosResponse<NoteCollectionReturn[]>, AxiosError, NoteCollectionRequest[], unknown>({
        mutationFn: (update) => API.NeurostoreServices.AnalysesService.annotationAnalysesPost(update),
        onSuccess: (response) => {
            const annotationQueryKey = annotationQueries.byId(annotationId).queryKey;

            if (options?.invalidateOnSuccess) {
                queryClient.invalidateQueries({ queryKey: annotationQueryKey });
                return;
            }

            const existingAnnotation = queryClient.getQueryData(annotationQueryKey);
            if (!existingAnnotation) return;

            const updatedNotes = response.data ?? [];
            const updatedNotesById = new Map(updatedNotes.map((note) => [note.id!, note]));

            queryClient.setQueryData(annotationQueryKey, {
                ...existingAnnotation,
                notes: (existingAnnotation.notes ?? []).map((note) => {
                    const updatedNote = updatedNotesById.get(note.id!);
                    return updatedNote ? { ...note, ...updatedNote } : note;
                }),
            });
        },
        onError: () => {
            enqueueSnackbar('there was an error updating the annotation', { variant: 'error' });
        },
    });
};

export default useUpdateAnnotationByAnnotationAndAnalysisIds;
