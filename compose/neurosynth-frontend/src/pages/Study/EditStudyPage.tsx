import { Box } from '@mui/material';
import { EAnalysisType } from 'hooks/projects/Project.types';
import BaseNavigationStyles from 'pages/BaseNavigation/BaseNavigation.styles';
import { useProjectAnalysisType } from 'stores/projects/ProjectStore';
import StudyCBMAPage from 'pages/StudyCBMA/StudyCBMA';
import StudyIBMAPage from 'pages/StudyIBMA/StudyIBMA';

const EditStudyPage: React.FC = () => {
    const analysisType = useProjectAnalysisType();

    if (analysisType === EAnalysisType.IBMA) {
        return <StudyIBMAPage />;
    }

    return (
        <Box sx={BaseNavigationStyles.pagesContainer}>
            <StudyCBMAPage />
        </Box>
    );
};

export default EditStudyPage;
