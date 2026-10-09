import type { ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import { useGetMetaAnalysisById, useUserCanEdit } from 'hooks';
import { Navigate, useLocation, useParams } from 'react-router-dom';

const ProtectedMetaAnalysisRoute = ({
    errorMessage = '',
    children,
}: {
    errorMessage?: string;
    children?: ReactNode;
}) => {
    const { metaAnalysisId } = useParams<{ metaAnalysisId: string }>();
    const { data, isLoading: getMetaAnalysisIsLoading, isError, error } = useGetMetaAnalysisById(metaAnalysisId);
    const { isLoading: getAuthIsLoading } = useAuth0();
    const { pathname } = useLocation();
    const userCanEdit = useUserCanEdit(data?.user ?? undefined);

    const isLoading = getMetaAnalysisIsLoading || getAuthIsLoading;
    const canView = userCanEdit || !!data?.public;

    if (isLoading) {
        return <NeurosynthLoader loaded={false} />;
    }

    if (isError) {
        console.error('There was an error loading the meta-analysis: ' + metaAnalysisId, error);
        throw new Error(JSON.stringify(error));
    }

    if (!canView) {
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

export default ProtectedMetaAnalysisRoute;
