import React, { ChangeEvent, useEffect, useState } from 'react';
import {
    TablePagination,
    Typography,
    Pagination,
    Box,
    IconButton,
    TableRow,
    TableCell,
    Tooltip,
    Chip,
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
        public userId: string | undefined = undefined,
        public dataType: 'coordinate' | 'image' | 'both' = 'coordinate',
        public studysetOwner: string | undefined = undefined
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

/**
 * Most common hashcode implementations multiply by 31 for mathematical reasons as it is odd, prime, and provides an acceptable distribution with minimal collisions:
 * https://stackoverflow.com/questions/299304/why-does-javas-hashcode-in-string-use-31-as-a-multiplier
 */
const stringToColor = (stringArg: string) => {
    // first step: create binary hashcode from string
    let hash = 0;
    for (let i = 0; i < stringArg.length; i++) {
        const charCode = stringArg.charCodeAt(i);
        const multiplier = (hash << 5) - hash; // Mathematically, 31 * i === (i << 5) - i
        hash = charCode + multiplier;
    }
    // second step: create hexadecimal string
    // a hexadecimal string describes the RGB value with the first two digits corresponding to R, second two to G, and final two to B.
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xff; // mask the ith 8th binary digits which correspond to a number between 0 and 255
        const hexColor = `00${value.toString(16)}`; // need the '00' to pad in case we don't have enough hexadecimal digits
        color = `${color}${hexColor.substring(hexColor.length - 2)}`;
    }
    return color;
};

const PublicStudiesPage = () => {
    const { startTour } = useGetTour('PublicStudiesPage');
    const history = useHistory();
    const location = useLocation();
    const { isAuthenticated, user, isLoading: authenticationIsLoading } = useAuth0();

    // state of the search bar
    const [searchBarParams, setSearchBarParams] = useState<{
        searchedString: string;
        searchBy: SearchBy;
    }>(extractSearchedStringFromURL(location.search));

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

    useEffect(() => {
        const urlSearchCriteria = getSearchCriteriaFromURL(location?.search);
        console.log(urlSearchCriteria);
        setSearchCriteria((prev) => {
            return { ...prev, ...urlSearchCriteria };
        });
    }, [location.search]);

    // runs for any change in study query, add set timeout and clear timeout for debounce
    useEffect(() => {
        const timeout = setTimeout(async () => {
            setApiSearch(searchCriteria);
        }, 400);

        return () => {
            clearTimeout(timeout);
        };
    }, [searchCriteria]);

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
                                data-tour={index === 0 ? 'PublicStudiesPage-4' : null}
                                sx={NeurosynthTableStyles.tableRow}
                                key={studyrow.id || index}
                                onClick={() => history.push(`/studies/${studyrow.id}`)}
                            >
                                <TableCell
                                    data-tour={index === 0 ? 'PublicStudiesPage-3' : null}
                                    sx={{ display: isAuthenticated ? 'table-cell' : 'none' }}
                                >
                                    <StudysetsPopupMenu study={studyrow} />
                                </TableCell>
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
