import {
    useProjectIsError,
    useProjectMetadataHasUnsavedchanges,
    useUpdateProjectIsLoading,
} from 'stores/projects/ProjectStore';
import LoadingStateIndicator from './LoadingStateIndicator';

const LoadingStateIndicatorProject = ({  isLoading  }: { isLoading?: boolean }) => {
    const updateProjectIsLoading = useUpdateProjectIsLoading();
    const projectMetadataHasUnsavedchanges = useProjectMetadataHasUnsavedchanges();
    const isError = useProjectIsError();

    return (
        <LoadingStateIndicator
            isLoading={updateProjectIsLoading || isLoading}
            isError={isError}
            hasUnsavedchanges={projectMetadataHasUnsavedchanges}
        />
    );
};

export default LoadingStateIndicatorProject;
