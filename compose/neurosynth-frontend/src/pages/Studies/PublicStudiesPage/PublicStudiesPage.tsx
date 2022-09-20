import React, { ChangeEvent, useEffect, useState } from 'react';
import {
    TablePagination,
    Typography,
    Pagination,
    Box,
    IconButton,
    TableRow,
    TableCell,
} from '@mui/material';
import PublicStudiesPageStyles from './PublicStudiesPage.styles';
import SearchBar from 'components/SearchBar/SearchBar';
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

export enum Source {
    NEUROSTORE = 'neurostore',
    NEUROVAULT = 'neurovault',
    PUBMED = 'pubmed',
    NEUROSYNTH = 'neurosynth',
    NEUROQUERY = 'neuroquery',
}

enum SortBy {
    NAME = 'name',
    AUTHORS = 'authors',
    DESCRIPTION = 'description',
    CREATEDAT = 'created_at',
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
        public userId: string | undefined = undefined
    ) {}
}

const getSearchCriteriaFromURL = (locationURL?: string): SearchCriteria => {
    const newSearchCriteria = new SearchCriteria();
    if (locationURL) {
        const search = new URLSearchParams(locationURL);

        let searchCriteriaObj: any = {}; // have to force this to be any so that we can assign props to the object
        for (const [key, value] of search) {
            if (key === 'pageOfResults' || key === 'pageSize') {
                const parsedValue = parseInt(value);
                if (!isNaN(parsedValue)) searchCriteriaObj[key] = parsedValue;
            } else if (key in newSearchCriteria) {
                searchCriteriaObj[key] = value;
            }
        }
        return {
            ...newSearchCriteria,
            ...searchCriteriaObj,
        };
    }
    return newSearchCriteria;
};

const getURLFromSearchCriteria = (searchCriteria: Partial<SearchCriteria>) => {
    let stringifiedValueSearch: Record<string, string> = {};
    for (let [key, value] of Object.entries(searchCriteria)) {
        stringifiedValueSearch[key] = `${value}`;
    }
    const search = new URLSearchParams(stringifiedValueSearch);
    return search.toString();
};

const addKVPToSearch = (locationURL: string, key: string, value: string) => {
    const search = new URLSearchParams(locationURL);
    search.has(key) ? search.set(key, value) : search.append(key, value);
    return search.toString();
};

const extractSearchedStringFromURL = (
    locationURL: string
): { searchedString: string; searchBy: SearchBy } => {
    const search = new URLSearchParams(locationURL);

    for (const searchByString in SearchBy) {
        const key = SearchBy[searchByString as keyof typeof SearchBy];
        if (search.has(key)) {
            return {
                searchBy: key,
                searchedString: search.get(key) || '',
            };
        }
    }

    return {
        searchBy: SearchBy.ALL,
        searchedString: '',
    };
};

const PublicStudiesPage = () => {
    const { startTour } = useGetTour('PublicStudiesPage');
    const history = useHistory();
    const location = useLocation();
    const { isAuthenticated, user } = useAuth0();

    const [searchBarParams, setSearchBarParams] = useState<{
        searchedString: string;
        searchBy: SearchBy;
    }>(extractSearchedStringFromURL(location.search));
    const [studyData, setStudyData] = useState<StudyList>();
    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>(new SearchCriteria());
    const { data, refetch, isLoading, isError, isRefetching } = useGetStudies(
        false,
        getSearchCriteriaFromURL(location.search)
    );

    /**
     * the data variable itself is undefined when refetch() is called, so we need to save it
     * in memory to craete a more stable experience when changing search criteria
     */
    useEffect(() => {
        if (data) setStudyData(data);
    }, [data]);

    useEffect(() => {
        const searchCriteria = getSearchCriteriaFromURL(location?.search);
        setSearchCriteria(searchCriteria);
    }, [location.search, refetch]);

    // runs for any change in study query, add set timeout and clear timeout for debounce
    useEffect(() => {
        const timeout = setTimeout(async () => {
            refetch();
        }, 300);

        return () => {
            clearTimeout(timeout);
        };
    }, [searchCriteria, refetch]);

    const getNumTotalPages = (totalCount: number | undefined, pageSize: number | undefined) => {
        if (!totalCount || !pageSize) {
            return 0;
        }
        const numTotalPages = Math.trunc(totalCount / pageSize);
        const remainder = totalCount % pageSize;
        return remainder > 0 ? numTotalPages + 1 : numTotalPages;
    };

    const handleOnSearch = (formEvent: React.FormEvent) => {
        const searchParamObj = {
            [searchBarParams.searchBy]: searchBarParams.searchedString,
        };
        // when we search, we want to reset the search criteria as we dont know the
        // page number of number of results in advance
        const searchURL = getURLFromSearchCriteria(searchParamObj);
        history.push(`/studies?${searchURL}`);
    };

    const handlePageChange = (
        event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null,
        page: number
    ) => {
        if (page === null) return;

        const searchURL = addKVPToSearch(location.search, 'pageOfResults', `${page + 1}`);
        history.push(`/studies?${searchURL}`);
    };

    const handleRowsPerPageChange = (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const newRowsPerPage = parseInt(event.target.value);
        if (!isNaN(newRowsPerPage)) {
            const searchURL = addKVPToSearch(
                addKVPToSearch(location.search, 'pageSize', `${newRowsPerPage}`),
                'pageOfResults',
                '1'
            );

            history.push(`/studies?${searchURL}`);
        }
    };

    const handlePaginationChange = (event: ChangeEvent<unknown>, page: number) => {
        if (page === null) return;
        const searchURL = addKVPToSearch(location.search, 'pageOfResults', `${page}`);
        history.push(`/studies?${searchURL}`);
    };

    return (
        <>
            <Box sx={{ display: 'flex' }}>
                <Typography variant="h4">Public Studies</Typography>
                <IconButton onClick={() => startTour()} color="primary">
                    <HelpIcon />
                </IconButton>
            </Box>

            <SearchBar
                onSearchByChange={(input) =>
                    setSearchBarParams((prev) => ({ ...prev, searchBy: input }))
                }
                onTextInputChange={(input) =>
                    setSearchBarParams((prev) => ({ ...prev, searchedString: input }))
                }
                onSearch={handleOnSearch}
                {...searchBarParams}
            />

            <Pagination
                siblingCount={2}
                boundaryCount={2}
                color="primary"
                sx={PublicStudiesPageStyles.paginator}
                onChange={handlePaginationChange}
                showFirstButton
                showLastButton
                page={
                    studyData?.metadata?.total_count === undefined
                        ? 0
                        : searchCriteria.pageOfResults
                }
                count={getNumTotalPages(studyData?.metadata?.total_count, searchCriteria.pageSize)}
            />

            <StateHandlerComponent isLoading={false} isError={isError}>
                <Box sx={{ marginBottom: '1rem' }}>
                    <NeurosynthTable
                        tableConfig={{
                            isLoading: isLoading || isRefetching,
                            loaderColor: 'secondary',
                            noDataDisplay: (
                                <Box sx={{ color: 'warning.dark', padding: '1rem' }}>
                                    No studies found
                                </Box>
                            ),
                        }}
                        headerCells={[
                            {
                                text: '',
                                key: 'addToStudysetCol',
                                styles: { display: isAuthenticated ? 'table-cell' : 'none' },
                            },
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
                        ]}
                        rows={(studyData?.results || []).map((data, index) => (
                            <TableRow
                                data-tour={index === 0 ? 'PublicStudiesPage-4' : null}
                                sx={NeurosynthTableStyles.tableRow}
                                key={data.id || index}
                                onClick={() => history.push(`/studies/${data.id}`)}
                            >
                                <TableCell
                                    data-tour={index === 0 ? 'PublicStudiesPage-3' : null}
                                    sx={{ display: isAuthenticated ? 'table-cell' : 'none' }}
                                >
                                    <StudysetsPopupMenu study={data} />
                                </TableCell>
                                <TableCell>
                                    {data?.name || (
                                        <Box sx={{ color: 'warning.dark' }}>No name</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {data?.authors || (
                                        <Box sx={{ color: 'warning.dark' }}>No author(s)</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {data?.publication || (
                                        <Box sx={{ color: 'warning.dark' }}>No Journal</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {(data?.user === user?.sub ? 'Me' : data?.user) ||
                                        'Neurosynth-Compose'}
                                </TableCell>
                            </TableRow>
                        ))}
                    />
                </Box>
            </StateHandlerComponent>

            <TablePagination
                rowsPerPage={searchCriteria.pageSize}
                onRowsPerPageChange={handleRowsPerPageChange}
                onPageChange={handlePageChange}
                component="div"
                rowsPerPageOptions={[10, 25, 50, 99]}
                // we have to do this because MUI's pagination component starts at 0,
                // whereas 0 and 1 are the same in the backend
                page={
                    studyData?.metadata?.total_count === undefined
                        ? 0
                        : searchCriteria.pageOfResults - 1
                }
                count={studyData?.metadata?.total_count || 0}
                sx={PublicStudiesPageStyles.paginator}
            />
        </>
    );
};
export default PublicStudiesPage;
