import API from 'api/api.config';
import { StudyRequest } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from 'react-query';
import studyQueries from 'hooks/studies/studyQueries';
import { StudyReturnNested } from './studyQueries.types';
import { AxiosResponse } from 'axios';

/**
 * The useCreateStudy hook creates a new study based on an existing stud, essentially
 * acting as a clone operation. Study data can be passed in as a StudyRequest object
 * so that the new study is cloned with updated data
 */

const useCreateStudy = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sourceId, data }: { sourceId: string; data: StudyRequest }) =>
            API.NeurostoreServices.StudiesService.studiesPost(undefined, sourceId, data) as Promise<
                AxiosResponse<StudyReturnNested, any, {}>
            >,
        onSuccess: () => {
            queryClient.invalidateQueries(studyQueries.studies.all());
            queryClient.invalidateQueries(studyQueries.baseStudies.all());
        },
    });
};

export default useCreateStudy;
