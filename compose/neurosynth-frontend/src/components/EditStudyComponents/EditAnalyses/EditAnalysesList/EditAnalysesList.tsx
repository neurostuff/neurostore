import { Box, List } from '@mui/material';
import { useStudyAnalyses } from 'pages/Studies/StudyStore';
import { useEffect } from 'react';
import EditAnalysesListItem from './EditAnalysesListItem';

const EditAnalysesList: React.FC<{
    onSelectAnalysis: (analysisId: string) => void;
    selectedAnalysisId?: string;
}> = (props) => {
    const analyses = useStudyAnalyses();

    // select the first analysis on first render
    useEffect(() => {
        if (!props.selectedAnalysisId && analyses[0]?.id) {
            props.onSelectAnalysis(analyses[0].id);
        }
    }, [analyses, props]);

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
                }}
                disablePadding
            >
                {analyses.map((analysis, index) => (
                    <EditAnalysesListItem
                        key={analysis.id || index}
                        analysisId={analysis.id}
                        name={analysis.name}
                        description={analysis.description}
                        onSelectAnalysis={props.onSelectAnalysis}
                        selected={(analysis.id || null) === (props.selectedAnalysisId || undefined)}
                    />
                ))}
            </List>
        </Box>
    );
};

export default EditAnalysesList;
