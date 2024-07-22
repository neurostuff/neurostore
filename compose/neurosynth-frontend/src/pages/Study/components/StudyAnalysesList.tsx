import { Box, List } from '@mui/material';
import StudyAnalysesListItem from 'pages/Study/components/StudyAnalysesListItem';
import { IStoreAnalysis } from 'pages/Study/store/StudyStore.helpers';

const StudyAnalysesList: React.FC<{
    analyses: IStoreAnalysis[];
    selectedId: string | undefined;
    onSelectAnalysisIndex: (id: string) => void;
}> = (props) => {
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
                {props.analyses.map((analysis) => (
                    <StudyAnalysesListItem
                        key={analysis.id}
                        analysis={analysis}
                        selected={(props.selectedId || undefined) === (analysis.id || null)}
                        onSelectAnalysis={(id) => props.onSelectAnalysisIndex(id)}
                    />
                ))}
            </List>
        </Box>
    );
};

export default StudyAnalysesList;
