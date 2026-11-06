import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import { useGetAnnotationById } from 'hooks';
import {
    useGetProjectIsLoading,
    useInitProjectStoreIfRequired,
    useProjectExtractionAnnotationId,
} from 'stores/projects/ProjectStore';

const AnnotationGuard: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const projectIsLoading = useGetProjectIsLoading();
    const annotationId = useProjectExtractionAnnotationId();

    useInitProjectStoreIfRequired();

    const {
        isLoading: getAnnotationIsLoading,
        isError: getAnnotationIsError,
        error: getAnnotationError,
    } = useGetAnnotationById(annotationId);

    if (getAnnotationIsLoading || projectIsLoading) {
        return <NeurosynthLoader loaded={false} />;
    }

    if (getAnnotationIsError) {
        console.error('There was an error loading the annotation: ' + annotationId, getAnnotationError);
        throw new Error(JSON.stringify(getAnnotationError));
    }

    return <>{children}</>;
};

export default AnnotationGuard;
