import { Button, Typography, Box, IconButton, TableRow, TableCell } from '@mui/material';
import { useHistory } from 'react-router-dom';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalyses, useGuard } from 'hooks';
import HelpIcon from '@mui/icons-material/Help';
import AddIcon from '@mui/icons-material/Add';
import useGetTour from 'hooks/useGetTour';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';

const UserMetaAnalysesPage: React.FC = (props) => {
    useGuard('/meta-analyses');
    const history = useHistory();
    const { startTour } = useGetTour('UserMetaAnalysesPage');
    const { data, isLoading, isError } = useGetMetaAnalyses();

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                }}
            >
                <Typography variant="h4">
                    My Meta-Analyses
                    <IconButton onClick={() => startTour()} color="primary">
                        <HelpIcon />
                    </IconButton>
                </Typography>

                <Button
                    data-tour="UserMetaAnalysesPage-2"
                    variant="contained"
                    onClick={() => history.push('/meta-analyses/build')}
                    color="primary"
                    startIcon={<AddIcon />}
                >
                    New meta-analysis
                </Button>
            </Box>
            <StateHandlerComponent isLoading={false} isError={isError}>
                <Box data-tour="UserMetaAnalysesPage-1">
                    <NeurosynthTable
                        tableConfig={{
                            isLoading: isLoading,
                            tableHeaderBackgroundColor: '#5C2751',
                            loaderColor: 'secondary',
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
                            </TableRow>
                        ))}
                    />
                </Box>
            </StateHandlerComponent>
        </>
    );
};

export default UserMetaAnalysesPage;
