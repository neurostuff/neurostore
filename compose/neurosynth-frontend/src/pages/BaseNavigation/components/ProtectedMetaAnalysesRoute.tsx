import { useAuth0 } from '@auth0/auth0-react';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import { useGetMetaAnalysisById } from 'hooks';
import useGetProjectById from 'hooks/projects/useGetProjectById';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { Navigate, useLocation, useParams } from 'react-router-dom';
const ProtectedMetaAnalysesRoute: React.FC<{
    errorMessage?: string;
}> = ({ errorMessage = '', children }) => {
    const { metaAnalysisId } = useParams<{ metaAnalysisId: string }>();
    const { data: metaAnalysis, isLoading: getMetaAnalysisIsLoading } = useGetMetaAnalysisById(metaAnalysisId);
    const { data: project, isLoading: getProjectIsLoading } = useGetProjectById(metaAnalysis?.project ?? undefined);
    const { isLoading: getAuthIsLoading } = useAuth0();
    const { pathname } = useLocation();
    const userCanEdit = useUserCanEdit(project?.user ?? undefined);

    const isOk = userCanEdit || project?.public;

    if (getProjectIsLoading || getMetaAnalysisIsLoading || getAuthIsLoading) {
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

export default ProtectedMetaAnalysesRoute;
