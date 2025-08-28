import { useAuth0 } from '@auth0/auth0-react';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import { useGetProjectById, useUserCanEdit } from 'hooks';
import { useGetProjectIsLoading, useInitProjectStoreIfRequired } from 'pages/Project/store/ProjectStore';
import { Navigate, useLocation, useParams } from 'react-router-dom';
const ProtectedProjectRoute: React.FC<{ onlyOwnerCanAccess?: boolean; errorMessage?: string }> = ({
    onlyOwnerCanAccess,
    errorMessage = '',
    children,
}) => {
    const { projectId } = useParams<{ projectId: string }>();
    const { data, isLoading: getProjectIsLoading, isError, error } = useGetProjectById(projectId);
    const storeIsLoading = useGetProjectIsLoading();
    const { isLoading: getAuthIsLoading } = useAuth0();
    const { pathname } = useLocation();
    const userCanEdit = useUserCanEdit(data?.user ?? undefined);

    useInitProjectStoreIfRequired();

    let isOk = true;
    if (onlyOwnerCanAccess) {
        isOk = userCanEdit;
    } else {
        isOk = userCanEdit || !!data?.public;
    }

    const isLoading = getProjectIsLoading || getAuthIsLoading || storeIsLoading;

    if (isLoading) {
        return <NeurosynthLoader loaded={false} />;
    }

    if (isError) {
        console.error('There was an error loading the project: ' + projectId);
        throw new Error(JSON.stringify(error)); // go to fallback page
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
