import { Box, List } from '@mui/material';
import EditAnalysesListItem from 'components/EditStudyComponents/EditAnalyses/EditAnalysesList/EditAnalysesListItem';
import { IStoreAnalysis } from 'pages/Studies/StudyStore.helpers';

const DisplayAnalysesList: React.FC<{
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
                    <EditAnalysesListItem
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

export default DisplayAnalysesList;
