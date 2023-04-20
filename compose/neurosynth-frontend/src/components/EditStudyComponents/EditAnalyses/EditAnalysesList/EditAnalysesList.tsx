import { Box, List } from '@mui/material';
import { useStudyAnalyses } from 'pages/Studies/StudyStore';
import { useEffect, useState } from 'react';
import EditAnalysesListItem from './EditAnalysesListItem';

const EditAnalysesList: React.FC<{
    onSelectAnalysis: (analysisId: string) => void;
    selectedAnalysisId?: string;
}> = (props) => {
    const analyses = useStudyAnalyses();
    const [selectedIndex, setSelectedIndex] = useState(0);

    const handleSelectAnalysis = (analysisId: string, index: number) => {
        setSelectedIndex(index);
        props.onSelectAnalysis(analysisId);
    };

    useEffect(() => {
        if (!analyses[0]?.id) return;

        if (!props.selectedAnalysisId) {
            // select the first analysis on first render
            props.onSelectAnalysis(analyses[0].id);
            return;
        }

        if (!analyses.find((x) => x.id === props.selectedAnalysisId)) {
            // when a new analysis is created and saved in the DB, it is given a neurostore ID which replaces the temporary one
            // initially given. We need to handle this case, otherwise the UI will show nothing is currently selected
            const newAnalysisId = analyses[selectedIndex].id;
            if (!newAnalysisId) return;
            props.onSelectAnalysis(newAnalysisId);
        }
    }, [analyses, props, selectedIndex]);

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
                        analysisId={analysis.id}
                        name={analysis.name}
                        index={index}
                        description={analysis.description}
                        onSelectAnalysis={handleSelectAnalysis}
                        selected={(analysis.id || null) === (props.selectedAnalysisId || undefined)}
                    />
                ))}
            </List>
        </Box>
    );
};

export default EditAnalysesList;
