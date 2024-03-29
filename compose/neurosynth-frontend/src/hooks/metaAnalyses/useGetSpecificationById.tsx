import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetSpecificationById = (specificationId?: string) => {
    return useQuery(
        ['specifications', specificationId],
        () =>
            API.NeurosynthServices.SpecificationsService.specificationsIdGet(specificationId || ''),
        {
            select: (res) => {
                return res.data;
            },
            enabled: !!specificationId,
        }
    );
};

export default useGetSpecificationById;
