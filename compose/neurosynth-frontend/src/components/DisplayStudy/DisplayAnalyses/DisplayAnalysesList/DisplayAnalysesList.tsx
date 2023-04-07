import { Box, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
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
                }}
                disablePadding
            >
                {props.analyses.map((analysis, index) => (
                    <ListItem key={analysis.id || index} disablePadding divider>
                        <ListItemButton
                            onClick={() => props.onSelectAnalysisIndex(index)}
                            selected={props.selectedIndex === index}
                        >
                            <ListItemText
                                sx={{ wordBreak: 'break-all' }}
                                primary={analysis.name || ''}
                                secondary={analysis.description || ''}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};

export default DisplayAnalysesList;
