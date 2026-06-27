import API from 'api/api.config';
import { AxiosError, AxiosResponse } from 'axios';
import analysisQueries from 'hooks/analyses/analysisQueries';
import { ImageRequest, ImageReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation } from 'react-query';

const useUpdateImage = () => {
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<AxiosResponse<ImageReturn>, AxiosError, { imageId: string; image: ImageRequest }, unknown>(
        (args) => API.NeurostoreServices.ImagesService.imagesIdPut(args.imageId, args.image),
        {
            mutationKey: analysisQueries.mutations.images.update(),
            onError: () => {
                enqueueSnackbar('there was an error updating the image', { variant: 'error' });
            },
        }
    );
};

export default useUpdateImage;
