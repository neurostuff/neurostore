import { useAuth0 } from '@auth0/auth0-react';
import { Box, TableCell, TableRow, Typography } from '@mui/material';
import SearchContainer from 'components/Search/SearchContainer';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NeurosynthTable from 'components/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/NeurosynthTable/NeurosynthTable.styles';
import { useGetBaseStudies } from 'hooks';
import { BaseStudyList } from 'neurostore-typescript-sdk';
import {
    addKVPToSearch,
    getSearchCriteriaFromURL,
    getURLFromSearchCriteria,
} from 'components/Search/search.helpers';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SearchCriteria } from '../Study/Study.types';

const StudiesPage = () => {
    // const { startTour } = useGetTour('StudiesPage');
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isLoading: authenticationIsLoading } = useAuth0();

    // cached data returned from the api
    const [studyData, setStudyData] = useState<BaseStudyList>();

    // state of the current search
    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
        ...new SearchCriteria(),
        ...getSearchCriteriaFromURL(location?.search),
    });

    // state of the search to the API (separated from searchCriteria to allow for debouncing)
    const [debouncedSearchCriteria, setDebouncedSearchCriteria] =
        useState<SearchCriteria>(searchCriteria);

    /**
     * This query will not be made until authentication has finished loading. The user?.sub property
     * exists before loading is complete so we are guaranteed that the first query will run
     * with the studysetOwner set (if logged in) and undefined otherwise
     */
    const { data, isLoading, isError, isFetching } = useGetBaseStudies(
        { ...debouncedSearchCriteria, studysetOwner: user?.sub },
        !authenticationIsLoading
    );

    /**
     * the data variable itself is undefined when refetching, so we need to save it
     * in memory to create a more stable experience when changing search criteria.
     * This is especially noticable when paginating
     */
    useEffect(() => {
        if (data) setStudyData(data);
    }, [data]);

    // runs every time the URL changes, to create a URL driven search.
    // this is separated from the debounce because otherwise the URL would
    // not update until the setTimeout is complete
    useEffect(() => {
        const urlSearchCriteria = getSearchCriteriaFromURL(location?.search);
        setSearchCriteria((prev) => {
            return { ...prev, ...urlSearchCriteria };
        });
    }, [location.search]);

    // runs for any change in study query
    // debounces above useEffect
    useEffect(() => {
        const timeout = setTimeout(async () => {
            setDebouncedSearchCriteria(searchCriteria);
        }, 500);

        return () => {
            clearTimeout(timeout);
        };
    }, [searchCriteria]);

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
        <StateHandlerComponent isLoading={false} isError={isError}>
            <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
                <Typography variant="h4">Studies</Typography>
            </Box>

            <SearchContainer
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                onSearch={handleSearch}
                totalCount={studyData?.metadata?.total_count}
                pageSize={searchCriteria.pageSize}
                pageOfResults={
                    (studyData?.results || []).length === 0 ? 1 : searchCriteria.pageOfResults
                }
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
                            isLoading: isLoading || isFetching,
                            loaderColor: 'secondary',
                            noDataDisplay: (
                                <Box sx={{ color: 'warning.dark', padding: '1rem' }}>
                                    No studies found
                                </Box>
                            ),
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
                                    {studyrow?.name || (
                                        <Box sx={{ color: 'warning.dark' }}>No name</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {studyrow?.authors || (
                                        <Box sx={{ color: 'warning.dark' }}>No author(s)</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {studyrow?.publication || (
                                        <Box sx={{ color: 'warning.dark' }}>No Publication</Box>
                                    )}
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
