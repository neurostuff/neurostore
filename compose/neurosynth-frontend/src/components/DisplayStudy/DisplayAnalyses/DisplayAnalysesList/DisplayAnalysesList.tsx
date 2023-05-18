import { Box, List } from '@mui/material';
import EditAnalysesListItem from 'components/EditStudyComponents/EditAnalyses/EditAnalysesList/EditAnalysesListItem';
import { AnalysisReturn } from 'neurostore-typescript-sdk';

const DisplayAnalysesList: React.FC<{
    analyses: AnalysisReturn[];
    selectedIndex: number;
    onSelectAnalysisIndex: (index: number) => void;
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
                {props.analyses.map((analysis, index) => (
                    <EditAnalysesListItem
                        key={analysis.id || index}
                        analysis={analysis}
                        index={index}
                        selected={props.selectedIndex === index}
                        onSelectAnalysis={(id, i) => props.onSelectAnalysisIndex(i)}
                    />
                ))}
            </List>
        </Box>
    );
};

export default DisplayAnalysesList;
