import { Box, List } from '@mui/material';
import { IStoreAnalysis } from 'pages/Study/store/StudyStore.helpers';
import { useCallback } from 'react';
import StudyAnalysesListItem from './StudyAnalysesListItem';

const EditStudyAnalysesList: React.FC<{
    onSelectAnalysis: (analysisId: string) => void;
    selectedAnalysisId?: string;
    analyses: IStoreAnalysis[];
}> = (props) => {
    const { onSelectAnalysis, selectedAnalysisId, analyses } = props;

    const handleSelectAnalysis = useCallback(
        (analysisId: string) => {
            onSelectAnalysis(analysisId);
        },
        [onSelectAnalysis]
    );

    return (
        <Box
            sx={{
                borderLeft: '1px solid lightgray',
                borderRight: '1px solid lightgray',
                width: '250px',
            }}
        >
            <List
                sx={{
                    width: '250px',
                    maxHeight: '70vh',
                    overflow: 'auto',
                }}
                disablePadding
            >
                {analyses.map((analysis) => (
                    <StudyAnalysesListItem
                        key={analysis.id}
                        analysis={analysis}
                        onSelectAnalysis={handleSelectAnalysis}
                        selected={(analysis.id || null) === (selectedAnalysisId || undefined)}
                    />
                ))}
            </List>
        </Box>
    );
};

export default EditStudyAnalysesList;
