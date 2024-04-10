import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import useGetProjectById from 'hooks/projects/useGetProjectById';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { Navigate, useParams } from 'react-router-dom';

const ProtectedProjectRoute: React.FC = (props) => {
    const { projectId } = useParams<{ projectId: string }>();
    const { data, isLoading } = useGetProjectById(projectId);
    const canEditProject = useUserCanEdit(data?.user || undefined);

    if (isLoading) {
        return <NeurosynthLoader loaded={false} />;
    }

    if (!canEditProject) {
        return <Navigate to="/forbidden" replace />;
    }

    return <>{props.children}</>;
};

export default ProtectedProjectRoute;
