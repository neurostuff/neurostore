import { Box, Divider, List, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalysesByIds } from 'hooks';
import React from 'react';
import ProjectsPageCardSummaryMetaAnalysesListItem from 'pages/Projects/components/ProjectsPageCardSummaryMetaAnalysesListItem';

const ProjectsPageCardSummaryMetaAnalyses: React.FC<{
    metaAnalysisIds: string[];
    projectId: string;
}> = (props) => {
    const { metaAnalysisIds } = props;

    const { data: metaAnalyses, isLoading, isError } = useGetMetaAnalysesByIds(metaAnalysisIds as string[]);
    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            <Typography sx={{ marginBottom: '0.5rem' }} fontWeight="bold">
                Meta Analyses:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', margin: '0.2rem 0 0.4rem 0' }}>
                {(metaAnalyses || []).length === 0 ? (
                    <Box>
                        <Typography color="warning.dark">No meta-analyses</Typography>
                    </Box>
                ) : (
                    <List sx={{ width: '100%' }} disablePadding>
                        <Divider />
                        {(metaAnalyses || []).map((metaAnalysis) => (
                            <ProjectsPageCardSummaryMetaAnalysesListItem
                                key={metaAnalysis.id}
                                metaAnalysis={metaAnalysis}
                            />
                        ))}
                    </List>
                )}
            </Box>
        </StateHandlerComponent>
    );
};

export default ProjectsPageCardSummaryMetaAnalyses;
