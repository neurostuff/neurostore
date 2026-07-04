import { Navigate, useParams } from 'react-router-dom';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import NotFoundPage from 'pages/NotFound/NotFoundPage';
import useGetMetaAnalysisById from 'hooks/metaAnalyses/useGetMetaAnalysisById';

// Resolves a legacy, project-less /meta-analyses/:id URL (written into NeuroVault by
// compose-runner) to the canonical project-scoped page.
const MetaAnalysisRedirect: React.FC = () => {
    const { metaAnalysisId } = useParams<{ metaAnalysisId: string }>();
    const { data, isLoading, isError } = useGetMetaAnalysisById(metaAnalysisId);

    if (isLoading) return <NeurosynthLoader loaded={false} />;

    const projectId = data?.project;
    if (isError || !projectId) return <NotFoundPage />;

    return <Navigate replace to={`/projects/${projectId}/meta-analyses/${metaAnalysisId}`} />;
};

export default MetaAnalysisRedirect;
