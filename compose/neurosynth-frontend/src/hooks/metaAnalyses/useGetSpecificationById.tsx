import { useQuery } from '@tanstack/react-query';
import API from 'api/api.config';

const useGetSpecificationById = (specificationId?: string) => {
    return useQuery({
        queryKey: ['specifications', specificationId],
        queryFn: () => API.NeurosynthServices.SpecificationsService.specificationsIdGet(specificationId || ''),

        select: (res) => {
            return res.data;
        },

        enabled: !!specificationId
    });
};

export default useGetSpecificationById;
