import { useEffect, useState } from 'react';
import { Typography, Box, IconButton, TableRow, TableCell, Tooltip, Chip } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import useGetTour from 'hooks/useGetTour';
import { useAuth0 } from '@auth0/auth0-react';
import { useGetStudies } from 'hooks';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useHistory, useLocation } from 'react-router-dom';
import { StudyList } from 'neurostore-typescript-sdk';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import StudysetsPopupMenu from 'components/StudysetsPopupMenu/StudysetsPopupMenu';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import SearchContainer from 'components/Search/SearchContainer/SearchContainer';
import {
    addKVPToSearch,
    getSearchCriteriaFromURL,
    getURLFromSearchCriteria,
    stringToColor,
} from 'pages/helpers/utils';

export enum SortBy {
    NAME = 'name',
    AUTHORS = 'authors',
    DESCRIPTION = 'description',
    CREATEDAT = 'created_at',
}

export enum Source {
    NEUROSTORE = 'neurostore',
    NEUROVAULT = 'neurovault',
    PUBMED = 'pubmed',
    NEUROSYNTH = 'neurosynth',
    NEUROQUERY = 'neuroquery',
}
export enum SearchBy {
    NAME = 'nameSearch',
    DESCRIPTION = 'descriptionSearch',
    AUTHORS = 'authorSearch',
    ALL = 'genericSearchStr',
}

export class SearchCriteria {
    constructor(
        public genericSearchStr: string | undefined = undefined,
        public sortBy: SortBy = SortBy.NAME,
        public pageOfResults: number = 1,
        public descOrder: boolean = true,
        public pageSize: number = 10,
        public isNested: boolean = false,
        public nameSearch: string | undefined = undefined,
        public descriptionSearch: string | undefined = undefined,
        public authorSearch: string | undefined = undefined,
        public showUnique: boolean = false,
        public source: Source | undefined = undefined,
        public userId: string | undefined = undefined,
        public dataType: 'coordinate' | 'image' | 'both' = 'coordinate',
        public studysetOwner: string | undefined = undefined
    ) {}
}

const StudiesPage = () => {
    const { startTour } = useGetTour('StudiesPage');
    const history = useHistory();
    const location = useLocation();
    const { isAuthenticated, user, isLoading: authenticationIsLoading } = useAuth0();

    // cached data returned from the api
    const [studyData, setStudyData] = useState<StudyList>();

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
    const { data, isLoading, isError, isFetching } = useGetStudies(
        { ...apiSearch, studysetOwner: user?.sub },
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

    useEffect(() => {
        if (user?.sub) {
            setSearchCriteria((prev) => ({
                ...prev,
                studysetOwner: user.sub,
            }));
        }
    }, [user?.sub]);

    // runs every time the URL changes, to create a URL driven search.
    // this is separated from the debounce because otherwise the URL would
    // not update until the setTimeout is complete
    useEffect(() => {
        const urlSearchCriteria = getSearchCriteriaFromURL(location?.search);
        setSearchCriteria((prev) => {
            return { ...prev, ...urlSearchCriteria };
        });
    }, [location.search]);

    // runs for any change in study query, add set timeout and clear timeout for debounce.
    useEffect(() => {
        const timeout = setTimeout(async () => {
            setApiSearch(searchCriteria);
        }, 200);

        return () => {
            clearTimeout(timeout);
        };
    }, [searchCriteria]);

    const handleSearch = (searchString: string, searchBy: SearchBy) => {
        // when we search, we want to reset the search criteria as we dont know the
        // page number of number of results in advance
        const searchURL = getURLFromSearchCriteria({ [searchBy]: searchString });
        history.push(`/studies?${searchURL}`);
    };

    const handleRowsPerPageChange = (newRowsPerPage: number) => {
        const searchURL = addKVPToSearch(
            addKVPToSearch(location.search, 'pageSize', `${newRowsPerPage}`),
            'pageOfResults',
            '1'
        );
        history.push(`/studies?${searchURL}`);
    };

    const handlePageChange = (page: number) => {
        const searchURL = addKVPToSearch(location.search, 'pageOfResults', `${page}`);
        history.push(`/studies?${searchURL}`);
    };

    return (
        <StateHandlerComponent isLoading={false} isError={isError}>
            <Box sx={{ display: 'flex' }}>
                <Typography variant="h4">Studies</Typography>
                <IconButton onClick={() => startTour()} color="primary">
                    <HelpIcon />
                </IconButton>
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
                                text: 'Journal',
                                key: 'journal',
                                styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                            },
                            {
                                text: 'Owner',
                                key: 'owner',
                                styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                            },
                            {
                                text: 'Studysets',
                                key: 'studysets',
                                styles: {
                                    display: isAuthenticated ? 'table-cell' : 'none',
                                    color: 'primary.contrastText',
                                    fontWeight: 'bold',
                                },
                            },
                        ]}
                        rows={(studyData?.results || []).map((studyrow, index) => (
                            <TableRow
                                data-tour={index === 0 ? 'StudiesPage-4' : null}
                                sx={NeurosynthTableStyles.tableRow}
                                key={studyrow.id || index}
                                onClick={() => history.push(`/studies/${studyrow.id}`)}
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
                                        <Box sx={{ color: 'warning.dark' }}>No Journal</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {(studyrow?.user === user?.sub ? 'Me' : studyrow?.user) ||
                                        'Neurosynth-Compose'}
                                </TableCell>
                                <TableCell
                                    sx={{ display: isAuthenticated ? 'table-cell' : 'none' }}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                    }}
                                >
                                    {(studyrow.studysets || []).map((studyset, index) => (
                                        <Tooltip
                                            key={studyset?.id || index}
                                            title={studyset?.name || ''}
                                            placement="top"
                                        >
                                            <Chip
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    history.push(`/studysets/${studyset.id || ''}`);
                                                }}
                                                size="small"
                                                sx={{
                                                    backgroundColor: stringToColor(
                                                        studyset?.id || ''
                                                    ),
                                                    color: 'white',
                                                    margin: '0.1rem',
                                                    maxWidth: '80px',
                                                }}
                                                label={studyset?.name || ''}
                                            />
                                        </Tooltip>
                                    ))}
                                </TableCell>
                            </TableRow>
                        ))}
                    />
                </Box>
            </SearchContainer>
        </StateHandlerComponent>
    );
};
export default StudiesPage;
