import { Box, TableCell, TableRow, Typography } from '@mui/material';
import NeurosynthTable from 'components/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/NeurosynthTable/NeurosynthTable.styles';
import { addKVPToSearch, getSearchCriteriaFromURL, getURLFromSearchCriteria } from 'components/Search/search.helpers';
import SearchContainer from 'components/Search/SearchContainer';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { baseStudiesSearchHelper } from 'hooks/studies/useGetBaseStudies';
import { BaseStudyList } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SearchCriteria } from '../Study/Study.types';
import { AxiosError } from 'axios';

const StudiesPage = () => {
    // const { startTour } = useGetTour('StudiesPage');
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const location = useLocation();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>();

    // cached data returned from the api
    const [studyData, setStudyData] = useState<BaseStudyList>();

    const searchCriteria = useMemo(() => {
        return {
            ...new SearchCriteria(),
            ...getSearchCriteriaFromURL(location?.search),
        };
    }, [location?.search]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            setIsLoading(true);
            baseStudiesSearchHelper({ ...searchCriteria, flat: true, info: false })
                .then((data) => {
                    setStudyData(data.data);
                })
                .catch(
                    (
                        err: AxiosError<{
                            detail: {
                                errors: {
                                    error: string;
                                }[];
                                message: string;
                            };
                        }>
                    ) => {
                        if (err.response?.status && err.response.status === 400 && err.response.data.detail.message) {
                            setError(err.response?.data.detail.message);
                        } else {
                            setError('There was an error searching for studies. (Is the query well formed?)');
                        }
                    }
                )
                .finally(() => {
                    setIsLoading(false);
                });
        }, 300);

        return () => {
            clearTimeout(debounce);
        };
    }, [enqueueSnackbar, searchCriteria]);

    const handleSearch = (searchArgs: Partial<SearchCriteria>) => {
        // when we search, we want to reset the search criteria as we dont know the
        // page number of number of results in advance
        const searchURL = getURLFromSearchCriteria(searchArgs);
        navigate(`/base-studies?${searchURL}`);
    };

    const handleRowsPerPageChange = (newRowsPerPage: number) => {
        const searchURL = addKVPToSearch(
            addKVPToSearch(location.search, 'pageSize', `${newRowsPerPage}`),
            'pageOfResults',
            '1'
        );
        navigate(`/base-studies?${searchURL}`);
    };

    const handlePageChange = (page: number) => {
        const searchURL = addKVPToSearch(location.search, 'pageOfResults', `${page}`);
        navigate(`/base-studies?${searchURL}`);
    };

    return (
        <StateHandlerComponent isLoading={false} isError={false}>
            <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
                <Typography variant="h4">Studies</Typography>
            </Box>

            <SearchContainer
                error={error}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                onSearch={handleSearch}
                totalCount={studyData?.metadata?.total_count}
                pageSize={searchCriteria.pageSize}
                pageOfResults={(studyData?.results || []).length === 0 ? 1 : searchCriteria.pageOfResults}
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
            </SearchContainer>
        </StateHandlerComponent>
    );
};
export default StudiesPage;
