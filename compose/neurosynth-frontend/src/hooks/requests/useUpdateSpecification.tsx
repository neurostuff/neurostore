import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import { StudyRequest, StudyReturn } from 'neurostore-typescript-sdk';
import API from 'utils/api';
import { SpecificationPostBody, SpecificationReturn } from 'neurosynth-compose-typescript-sdk';

const useUpdateSpecification = () => {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    return useMutation<
        AxiosResponse<SpecificationReturn>,
        AxiosError,
        {
            specificationId: string;
            specification: SpecificationPostBody;
        },
        unknown
    >(
        (args) =>
            API.NeurosynthServices.SpecificationsService.specificationsIdPut(
                args.specificationId,
                args.specification
            ),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('specifications');
                enqueueSnackbar('specification updated successfully', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the specification', {
                    variant: 'error',
                });
            },
        }
    );
};

export default useUpdateSpecification;
