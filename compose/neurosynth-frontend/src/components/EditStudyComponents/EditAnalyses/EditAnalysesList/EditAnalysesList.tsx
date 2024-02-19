import { Box, List } from '@mui/material';
import { IStoreAnalysis } from 'pages/Studies/StudyStore.helpers';
import { useCallback } from 'react';
import EditAnalysesListItem from './EditAnalysesListItem';

const EditAnalysesList: React.FC<{
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
                    <EditAnalysesListItem
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

export default EditAnalysesList;
