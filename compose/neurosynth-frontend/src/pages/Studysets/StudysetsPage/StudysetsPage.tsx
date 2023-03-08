import { Box, IconButton, TableCell, TableRow, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import useGetTour from 'hooks/useGetTour';
import HelpIcon from '@mui/icons-material/Help';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudysets } from 'hooks';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import { useAuth0 } from '@auth0/auth0-react';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { useHistory, useLocation } from 'react-router-dom';
import SearchContainer from 'components/Search/SearchContainer/SearchContainer';
import { SearchCriteria } from 'pages/Studies/StudiesPage/StudiesPage';
import { StudysetList } from 'neurostore-typescript-sdk';
import {
    addKVPToSearch,
    getNumStudiesString,
    getSearchCriteriaFromURL,
    getURLFromSearchCriteria,
} from 'pages/helpers/utils';

const StudysetsPage: React.FC = (props) => {
    const { startTour } = useGetTour('StudysetsPage');
    const { user, isLoading: authenticationIsLoading } = useAuth0();
    const history = useHistory();
    const location = useLocation();

    // cached data returned from the api
    const [studysetData, setStudysetData] = useState<StudysetList>();

    // state of the current search
    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
        ...new SearchCriteria(),
        ...getSearchCriteriaFromURL(location?.search),
    });

    // state of the search to the API (separated from searchCriteria to allow for debouncing)
    const [apiSearch, setApiSearch] = useState<SearchCriteria>(searchCriteria);

    /**
     * This query will not be made until authentication has finished loading. The user?.sub property
     * exists before loading is complete so we are guaranteed that the first query will run
     * with the studysetOwner set (if logged in) and undefined otherwise
     */
    const { data, isError, isLoading } = useGetStudysets(
        { ...apiSearch },
        !authenticationIsLoading
    );

    /**
     * the data variable itself is undefined when refetching, so we need to save it
     * in memory to create a more stable experience when changing search criteria.
     * This is especially noticable when paginating
     */
    useEffect(() => {
        if (data) setStudysetData(data);
    }, [data]);

    useEffect(() => {
        const urlSearchCriteria = getSearchCriteriaFromURL(location?.search);
        setSearchCriteria((prev) => {
            return { ...prev, ...urlSearchCriteria };
        });
    }, [location.search]);

    // runs for any change in study query, add set timeout and clear timeout for debounce
    useEffect(() => {
        const timeout = setTimeout(async () => {
            setApiSearch(searchCriteria);
        }, 200);

        return () => {
            clearTimeout(timeout);
        };
    }, [searchCriteria]);

    const handlePageChange = (page: number) => {
        const searchURL = addKVPToSearch(location.search, 'pageOfResults', `${page}`);
        history.push(`/studysets?${searchURL}`);
    };

    const handleRowsPerPageChange = (newRowsPerPage: number) => {
        const searchURL = addKVPToSearch(
            addKVPToSearch(location.search, 'pageSize', `${newRowsPerPage}`),
            'pageOfResults',
            '1'
        );
        history.push(`/studysets?${searchURL}`);
    };

    const handleSearch = (search: Partial<SearchCriteria>) => {
        // const searchURL = getURLFromSearchCriteria({ [searchBy]: searchString });
        // history.push(`/studysets?${searchURL}`);
    };

    return (
        <StateHandlerComponent isLoading={false} isError={isError}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                }}
            >
                <Typography variant="h4">
                    Studysets
                    <IconButton color="primary" onClick={() => startTour()}>
                        <HelpIcon />
                    </IconButton>
                </Typography>
            </Box>
            <SearchContainer
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                onSearch={handleSearch}
                totalCount={studysetData?.metadata?.total_count || 0}
                pageSize={searchCriteria.pageSize}
                pageOfResults={searchCriteria.pageOfResults}
                searchButtonColor="#42ab55"
                paginationSelectorStyles={{
                    '& .MuiPaginationItem-root.Mui-selected': {
                        backgroundColor: '#42ab55',
                        color: 'primary.contrastText',
                    },
                }}
            >
                <Box data-tour="StudysetsPage-1">
                    <NeurosynthTable
                        tableConfig={{
                            isLoading: isLoading,
                            tableHeaderBackgroundColor: '#42ab55',
                            loaderColor: 'secondary',
                            tableElevation: 2,
                        }}
                        headerCells={[
                            {
                                text: 'Name',
                                key: 'name',
                                styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                            },
                            {
                                text: 'Number of Studies',
                                key: 'numberStudies',
                                styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                            },
                            {
                                text: 'Description',
                                key: 'description',
                                styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                            },
                            {
                                text: 'User',
                                key: 'user',
                                styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                            },
                        ]}
                        rows={(studysetData?.results || []).map((studyset) => (
                            <TableRow
                                key={studyset?.id}
                                onClick={() => history.push(`studysets/${studyset?.id}`)}
                                sx={NeurosynthTableStyles.tableRow}
                            >
                                <TableCell>
                                    {studyset?.name || (
                                        <Box sx={{ color: 'warning.dark' }}>No name</Box>
                                    )}
                                </TableCell>
                                <TableCell
                                    sx={{
                                        color:
                                            (studyset.studies || []).length === 0
                                                ? 'warning.dark'
                                                : 'black',
                                    }}
                                >
                                    {getNumStudiesString(studyset.studies)}
                                </TableCell>
                                <TableCell>
                                    {studyset?.description || (
                                        <Box sx={{ color: 'warning.dark' }}>No description</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {(studyset?.user === user?.sub ? 'Me' : studyset?.user) ||
                                        'Neurosynth-Compose'}
                                </TableCell>
                            </TableRow>
                        ))}
                    />
                </Box>
            </SearchContainer>
        </StateHandlerComponent>
    );
};

export default StudysetsPage;
