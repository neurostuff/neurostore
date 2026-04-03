import { EAnalysisType } from 'hooks/projects/Project.types';
import { useProjectAnalysisType } from 'pages/Project/store/ProjectStore';
import StudyCBMAPage from 'pages/StudyCBMA/StudyCBMA';
import StudyIBMAPage from 'pages/StudyIBMA/StudyIBMA';

const EditStudyPage: React.FC = () => {
    const analysisType = useProjectAnalysisType();

    if (analysisType === EAnalysisType.IBMA) {
        return <StudyIBMAPage />;
    }

    return <StudyCBMAPage />;
};

export default EditStudyPage;
