import { useAuth0 } from '@auth0/auth0-react';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import { useGetProjectById } from 'hooks';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { useInitProjectStoreIfRequired } from 'pages/Project/store/ProjectStore';
import { Navigate, useLocation, useParams } from 'react-router-dom';
const ProtectedProjectRoute: React.FC<{ onlyOwnerCanAccess?: boolean; errorMessage?: string }> = ({
    onlyOwnerCanAccess,
    errorMessage = '',
    children,
}) => {
    const { projectId } = useParams<{ projectId: string }>();
    const { data, isLoading: getProjectIsLoading, isError } = useGetProjectById(projectId);
    const { isLoading: getAuthIsLoading } = useAuth0();
    const { pathname } = useLocation();
    const userCanEdit = useUserCanEdit(data?.user ?? undefined);

    useInitProjectStoreIfRequired();

    let isOk = true;
    if (isError) {
        isOk = false;
    } else if (onlyOwnerCanAccess) {
        isOk = userCanEdit;
    } else {
        isOk = userCanEdit || !!data?.public;
    }

    const isLoading = getProjectIsLoading || getAuthIsLoading;

    if (isLoading) {
        return <NeurosynthLoader loaded={false} />;
    }

    if (!isOk) {
        return (
            <Navigate
                to="/forbidden"
                replace
                state={{ errorMessage: errorMessage || `You do not have access to ${pathname}` }}
            />
        );
    }

    return <>{children}</>;
};

export default ProtectedProjectRoute;
