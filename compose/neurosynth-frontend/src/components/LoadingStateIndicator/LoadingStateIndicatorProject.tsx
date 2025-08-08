import { useProjectMetadataHasUnsavedchanges, useUpdateProjectIsLoading } from 'pages/Project/store/ProjectStore';
import LoadingStateIndicator from './LoadingStateIndicator';

const LoadingStateIndicatorProject: React.FC<{ isLoading?: boolean }> = ({ isLoading }) => {
    const updateProjectIsLoading = useUpdateProjectIsLoading();
    const projectMetadataHasUnsavedchanges = useProjectMetadataHasUnsavedchanges();

    return (
        <LoadingStateIndicator
            isLoading={updateProjectIsLoading || isLoading}
            hasUnsavedchanges={projectMetadataHasUnsavedchanges}
        />
    );
};

export default LoadingStateIndicatorProject;
