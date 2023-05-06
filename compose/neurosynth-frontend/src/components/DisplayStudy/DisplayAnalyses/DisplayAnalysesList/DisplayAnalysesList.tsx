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
                        index={index}
                        analysisId={analysis.id}
                        name={analysis.name}
                        points={analysis.points || []}
                        description={analysis.description}
                        selected={props.selectedIndex === index}
                        onSelectAnalysis={(id, i) => props.onSelectAnalysisIndex(i)}
                    />
                    // <ListItem key={analysis.id || index} disablePadding divider>
                    //     <ListItemButton
                    //         onClick={() => props.onSelectAnalysisIndex(index)}
                    //         selected={props.selectedIndex === index}
                    //     >
                    //         <ListItemText
                    //             sx={{ wordBreak: 'break-all' }}
                    //             primary={analysis.name || ''}
                    //             secondary={analysis.description || ''}
                    //         />
                    //         {(analysis.points?.length || 0) === 0 && (
                    //             <Tooltip title="There is a potential issue" placement="top">
                    //                 <ListItemIcon>
                    //                     <ErrorOutlineIcon color="warning" />
                    //                 </ListItemIcon>
                    //             </Tooltip>
                    //         )}
                    //     </ListItemButton>
                    // </ListItem>
                ))}
            </List>
        </Box>
    );
};

export default DisplayAnalysesList;
