import { Box, TableCell, TableRow, Typography } from '@mui/material';
import NeurosynthTable from 'components/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/NeurosynthTable/NeurosynthTable.styles';
import StudiesSearchContainer from 'components/Search/StudiesSearchContainer';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useNavigate } from 'react-router-dom';
import { usePrerenderReady, usePageMetadata } from '../../../seo/hooks';
import useSearchStudies from 'pages/Studies/hooks/useSearchStudies';

const StudiesPage = () => {
    const navigate = useNavigate();
    const {
        studyData,
        isLoading,
        error,
        handleSearch,
        handlePageChange,
        handleRowsPerPageChange,
        pageSize,
        pageOfResults,
    } = useSearchStudies();

    const isPrerenderReady = !isLoading && (!!studyData || !!error);

    usePageMetadata({
        title: 'Base Studies | Neurosynth Compose',
        description:
            'Search curated neuroimaging studies with coordinates, metadata, and provenance for meta-analysis in Neurosynth Compose.',
        canonicalPath: '/base-studies',
    });
    usePrerenderReady(isPrerenderReady);

    return (
        <StateHandlerComponent isLoading={false} isError={false}>
            <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
                <Typography variant="h4">Studies</Typography>
            </Box>

            <StudiesSearchContainer
                error={error}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                onSearch={handleSearch}
                totalCount={studyData?.metadata?.total_count}
                pageSize={pageSize}
                pageOfResults={(studyData?.results || []).length === 0 ? 1 : pageOfResults}
                paginationSelectorStyles={{
                    '& .MuiPaginationItem-root.Mui-selected': {
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                    },
                }}
            >
                <Box sx={{ marginBottom: '1rem' }}>
                    <NeurosynthTable
                        tableConfig={{
                            isLoading: isLoading,
                            loaderColor: 'secondary',
                            noDataDisplay: <Box sx={{ color: 'warning.dark', padding: '1rem' }}>No studies found</Box>,
                        }}
                        headerCells={[
                            {
                                text: 'Title',
                                key: 'title',
                                styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                            },
                            {
                                text: 'Authors',
                                key: 'authors',
                                styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                            },
                            {
                                text: 'Publication',
                                key: 'publication',
                                styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                            },
                            {
                                text: 'Owner',
                                key: 'owner',
                                styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                            },
                        ]}
                        rows={(studyData?.results || []).map((studyrow, index) => (
                            <TableRow
                                data-tour={index === 0 ? 'StudiesPage-4' : null}
                                sx={NeurosynthTableStyles.tableRow}
                                key={studyrow.id || index}
                                onClick={() => navigate(`/base-studies/${studyrow.id}`)}
                            >
                                <TableCell>
                                    {studyrow?.name || <Box sx={{ color: 'warning.dark' }}>No name</Box>}
                                </TableCell>
                                <TableCell>
                                    {studyrow?.authors || <Box sx={{ color: 'warning.dark' }}>No author(s)</Box>}
                                </TableCell>
                                <TableCell>
                                    {studyrow?.publication || <Box sx={{ color: 'warning.dark' }}>No Publication</Box>}
                                </TableCell>
                                <TableCell>{studyrow?.username || 'Neurosynth-Compose'}</TableCell>
                            </TableRow>
                        ))}
                    />
                </Box>
            </StudiesSearchContainer>
        </StateHandlerComponent>
    );
};
export default StudiesPage;
