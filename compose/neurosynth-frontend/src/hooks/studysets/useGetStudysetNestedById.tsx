import { AxiosError } from 'axios';
import { useSnackbar } from 'notistack';
import { useQuery } from 'react-query';
import studysetQueries from 'hooks/studysets/studysetQueries';
import { StudysetReturnNested } from 'hooks/studysets/studysetQueries.types';

const useGetStudysetNestedById = (studysetId?: string) => {
    const { enqueueSnackbar } = useSnackbar();
    return useQuery<StudysetReturnNested, AxiosError>({
        ...studysetQueries.nestedById(studysetId),
        onError: () => {
            enqueueSnackbar('there was an error retrieving the studyset', { variant: 'error' });
        },
    });
};

export default useGetStudysetNestedById;
