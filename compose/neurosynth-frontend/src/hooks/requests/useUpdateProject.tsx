import { AxiosError, AxiosResponse } from 'axios';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { useMutation } from 'react-query';
import API from 'utils/api';
import { INeurosynthProject } from './useGetProjects';

const useUpdateProject = () => {
    return useMutation<
        AxiosResponse<ProjectReturn>,
        AxiosError,
        { projectId: string; project: INeurosynthProject },
        unknown
    >(
        (args) =>
            API.NeurosynthServices.ProjectsService.projectsIdPut(args.projectId, args.project),
        {
            // onSuccess: (res) => {
            //     const x = queryClient.isMutating({
            //         predicate: (m) => m.options.mutationKey === 'projects',
            //     });
            //     if (x <= 1) {
            //         queryClient.invalidateQueries('projects');
            //     }
            // },
            // mutationKey: 'projects',
        }
    );
};

export default useUpdateProject;
