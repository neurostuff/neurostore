import ExploreMetaAnalysisPage from 'pages/Explore/ExploreMetaAnalysisPage';
import { MOCK_BRAIN_MAPS } from 'pages/Explore/Explore.mockData';
import MetaAnalysisRedirect from 'pages/MetaAnalysis/MetaAnalysisRedirect';
import { useParams } from 'react-router-dom';

/**
 * `/meta-analyses/:id` entry: explore mock wireframe when the id matches mock Explore data;
 * otherwise preserve legacy NeuroVault redirect into the project-scoped meta-analysis page.
 */
const MetaAnalysisByIdEntry = () => {
    const { metaAnalysisId } = useParams<{ metaAnalysisId: string }>();
    const mockBrainMap = MOCK_BRAIN_MAPS.find((brainMap) => brainMap.id === metaAnalysisId);

    if (mockBrainMap) {
        return <ExploreMetaAnalysisPage brainMap={mockBrainMap} />;
    }

    return <MetaAnalysisRedirect />;
};

export default MetaAnalysisByIdEntry;
