import { Box, TableCell, TableRow, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { useGetMetaAnalysesByIds } from 'hooks';
import { useProjectMetaAnalyses } from 'pages/Projects/ProjectPage/ProjectStore';
import { MetaAnalysisReturn } from 'neurosynth-compose-typescript-sdk';
import { useHistory } from 'react-router-dom';

const MetaAnalysesPage: React.FC = (props) => {
    const history = useHistory();
    const projectMetaAnalyses = useProjectMetaAnalyses() || [];
    let metaAnalysisIds: string[] = [];
    if (projectMetaAnalyses.length > 0) {
        if (typeof projectMetaAnalyses[0] === 'string') {
            metaAnalysisIds = projectMetaAnalyses as string[];
        } else {
            metaAnalysisIds = (projectMetaAnalyses as MetaAnalysisReturn[])
                .map((metaAnalysis) => metaAnalysis.id)
                .filter((id): id is string => id !== undefined);
        }
    }
    const { data, isLoading, isError } = useGetMetaAnalysesByIds(metaAnalysisIds);

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    marginBottom: '1rem',
                }}
            >
                <Typography variant="h4">Meta-Analyses</Typography>
            </Box>

            <StateHandlerComponent
                isError={isError}
                isLoading={false}
                errorMessage="There was an error fetching meta-analyses"
            >
                <Box data-tour="MetaAnalysesPage-1">
                    <NeurosynthTable
                        tableConfig={{
                            isLoading: isLoading,
                            loaderColor: 'secondary',
                            tableHeaderBackgroundColor: '#5C2751',
                        }}
                        headerCells={[
                            {
                                text: 'Name',
                                key: 'name',
                                styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                            },
                            {
                                text: 'Description',
                                key: 'description',
                                styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                            },
                            {
                                text: 'Owner',
                                key: 'owner',
                                styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                            },
                        ]}
                        rows={(data || []).map((metaAnalysis, index) => (
                            <TableRow
                                onClick={() => history.push(`/meta-analyses/${metaAnalysis?.id}`)}
                                key={metaAnalysis?.id || index}
                                sx={NeurosynthTableStyles.tableRow}
                            >
                                <TableCell>
                                    {metaAnalysis?.name || (
                                        <Box sx={{ color: 'warning.dark' }}>No name</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {metaAnalysis?.description || (
                                        <Box sx={{ color: 'warning.dark' }}>No description</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {/* TODO: fix the model to add the username property */}
                                    {(metaAnalysis as any)?.username || 'Neurosynth-Compose'}
                                </TableCell>
                            </TableRow>
                        ))}
                    />
                </Box>
            </StateHandlerComponent>
        </>
    );
};

export default MetaAnalysesPage;
