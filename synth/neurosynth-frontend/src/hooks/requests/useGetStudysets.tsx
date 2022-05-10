import { useQuery } from 'react-query';
import API from '../../utils/api';

const useGetStudysets = () => {
    return useQuery('studysets', () => API.NeurostoreServices.StudySetsService.studysetsGet(), {
        select: (res) => res.data.results,
    });
};

export default useGetStudysets;
