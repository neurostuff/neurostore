import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalysesByIds } from 'hooks';
import React from 'react';
import { Link } from 'react-router-dom';

const ProjectPageCardSummaryMetaAnalyses: React.FC<{
    metaAnalysisIds: string[];
    projectId: string;
}> = (props) => {
    const { metaAnalysisIds, projectId } = props;

    const {
        data: metaAnalyses,
        isLoading,
        isError,
    } = useGetMetaAnalysesByIds(metaAnalysisIds as string[]);
    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            <Typography fontWeight="bold">Meta Analyses:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', margin: '0.2rem 0 0.4rem 0' }}>
                {(metaAnalyses || []).length === 0 ? (
                    <Box>
                        <Typography color="warning.dark">No meta-analyses</Typography>
                    </Box>
                ) : (
                    <List sx={{ width: '100%' }} disablePadding>
                        {(metaAnalyses || []).map((metaAnalysis) => (
                            <ListItem disablePadding disableGutters key={metaAnalysis.id} divider>
                                <ListItemButton
                                    component={Link}
                                    to={`/projects/${projectId}/meta-analyses/${metaAnalysis.id}`}
                                >
                                    <ListItemText
                                        sx={{ minHeight: '44px' }}
                                        primaryTypographyProps={{ color: 'primary.dark' }}
                                        primary={metaAnalysis.name}
                                        secondary={metaAnalysis.description}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}
            </Box>
        </StateHandlerComponent>
    );
};

export default ProjectPageCardSummaryMetaAnalyses;
