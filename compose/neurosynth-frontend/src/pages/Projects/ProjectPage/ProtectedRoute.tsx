import useUserCanEdit from 'hooks/useUserCanEdit';
import { useProjectUser } from './ProjectStore';
import { Navigate } from 'react-router-dom';

const ProtectedProjectRoute: React.FC = (props) => {
    const projectUser = useProjectUser();
    const canEditProject = useUserCanEdit(projectUser || undefined);

    if (!canEditProject) {
        return <Navigate to="/forbidden" replace />;
    }

    return <>{props.children}</>;
};

export default ProtectedProjectRoute;
