import { Box } from '@mui/material';
import BaseNavigationStyles from 'pages/BaseNavigation/BaseNavigation.styles';
import { useProjectAnalysisType } from 'stores/projects/ProjectStore';
import StudyCBMAPage from 'pages/StudyCBMA/StudyCBMA';
import StudyIBMAPage from 'pages/StudyIBMA/StudyIBMA';
import { NAVBAR_HEIGHT } from 'components/Navbar/Navbar';
import { EAnalysisType } from 'hooks/projects/Project.types';

const EditStudyPage: React.FC = () => {
    const analysisType = useProjectAnalysisType();

    if (analysisType === EAnalysisType.IBMA) {
        return (
            <Box sx={{ backgroundColor: '#fbfbfb', minHeight: `calc(100vh - ${NAVBAR_HEIGHT}px)` }}>
                <StudyIBMAPage />
            </Box>
        );
    }

    return (
        <Box sx={BaseNavigationStyles.pagesContainer}>
            <StudyCBMAPage />
        </Box>
    );
};

export default EditStudyPage;
