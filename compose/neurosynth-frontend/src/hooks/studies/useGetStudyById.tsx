import { AxiosError, AxiosResponse } from 'axios';
import { AnalysisReturn, StudyReturn } from 'neurostore-typescript-sdk';
import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetStudyById = (studyId: string | undefined) => {
    return useQuery<
        AxiosResponse<StudyReturn>,
        AxiosError,
        StudyReturn,
        [string, string | undefined]
    >(
        ['studies', studyId],
        () => API.NeurostoreServices.StudiesService.studiesIdGet(studyId || '', true),
        {
            select: (res) => {
                const analyses = res.data.analyses as AnalysisReturn[];

                const sortedAnalyses = (analyses || []).sort((a, b) => {
                    return (a.name || '').localeCompare(b.name || '');
                    // this sorts by creation date: we may want this later
                    // const dateA = Date.parse(a.created_at || '');
                    // const dateB = Date.parse(b.created_at || '');
                    // if (isNaN(dateA) || isNaN(dateB)) return 0;
                    // return dateB - dateA;
                });

                res.data.analyses = sortedAnalyses;
                return res.data;
            },
            onError: (err) => {
                console.log(err);
            },
            enabled: !!studyId,
        }
    );
};

export default useGetStudyById;
