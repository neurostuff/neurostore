import { Box, List } from '@mui/material';
import { useStudyAnalyses } from 'pages/Studies/StudyStore';
import { useCallback, useEffect, useState } from 'react';
import EditAnalysesListItem from './EditAnalysesListItem';

const EditAnalysesList: React.FC<{
    onSelectAnalysis: (analysisId: string) => void;
    selectedAnalysisId?: string;
}> = (props) => {
    const { onSelectAnalysis, selectedAnalysisId } = props;

    const analyses = useStudyAnalyses();
    const [selectedIndex, setSelectedIndex] = useState(0);

    const handleSelectAnalysis = useCallback(
        (analysisId: string, index: number) => {
            setSelectedIndex(index);
            onSelectAnalysis(analysisId);
        },
        [onSelectAnalysis]
    );

    useEffect(() => {
        if (!analyses[0]?.id) return;

        if (!selectedAnalysisId) {
            // select the first analysis on first render
            onSelectAnalysis(analyses[0].id);
            return;
        }

        if (!analyses.find((x) => x.id === selectedAnalysisId)) {
            // when a new analysis is created and saved in the DB, it is given a neurostore ID which replaces the temporary one
            // initially given. We need to handle this case, otherwise the UI will show nothing is currently selected
            const newAnalysisId = analyses[selectedIndex].id;
            if (!newAnalysisId) return;
            onSelectAnalysis(newAnalysisId);
        }
    }, [analyses, onSelectAnalysis, selectedIndex, selectedAnalysisId]);

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
                {analyses.map((analysis, index) => (
                    <EditAnalysesListItem
                        key={analysis.id || index}
                        analysis={analysis}
                        index={index}
                        onSelectAnalysis={handleSelectAnalysis}
                        selected={(analysis.id || null) === (props.selectedAnalysisId || undefined)}
                    />
                ))}
            </List>
        </Box>
    );
};

export default EditAnalysesList;
