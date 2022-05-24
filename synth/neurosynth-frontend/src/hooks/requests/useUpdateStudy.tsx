import { AxiosError, AxiosResponse } from 'axios';
import { useMutation } from 'react-query';
import { Study, StudyReturn } from '../../neurostore-typescript-sdk';
import API from '../../utils/api';

const useUpdateStudy = () => {
    return useMutation<
        AxiosResponse<StudyReturn>,
        AxiosError,
        {
            studyId: string;
            study: Study;
        },
        unknown
    >((args) => API.NeurostoreServices.StudiesService.studiesIdPut(args.studyId, args.study));
};

export default useUpdateStudy;
