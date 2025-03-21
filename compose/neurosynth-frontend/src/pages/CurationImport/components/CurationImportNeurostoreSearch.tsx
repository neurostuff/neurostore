import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, TableCell, TableRow } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import SearchContainer from 'components/Search/SearchContainer';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NeurosynthTable from 'components/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/NeurosynthTable/NeurosynthTable.styles';
import { baseStudiesSearchHelper } from 'hooks/studies/useGetBaseStudies';
import useGetDebouncedBaseStudies from 'hooks/studies/useGetDebouncedBaseStudies';
import { BaseStudyList } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useProjectId } from 'pages/Project/store/ProjectStore';
import { SearchCriteria } from 'pages/Study/Study.types';
import {
    addKVPToSearch,
    getSearchCriteriaFromURL,
    getURLFromSearchCriteria,
} from 'components/Search/search.helpers';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IImportArgs } from './CurationImportDoImport';
import CurationImportBaseStyles from './CurationImport.styles';
import { studiesToStubs } from 'helpers/Curation.helpers';

const CurationImportNeurostoreSearch: React.FC<IImportArgs> = (props) => {
    const { isLoading: authenticationIsLoading } = useAuth0();

    const [importIsLoading, setImportIsLoading] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

    const navigate = useNavigate();
    const location = useLocation();
    const projectId = useProjectId();

    // cached data returned from the api
    const [studyData, setStudyData] = useState<BaseStudyList>();

    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
        ...new SearchCriteria(),
        ...getSearchCriteriaFromURL(location?.search),
    });

    const { data, isLoading, isError, isFetching } = useGetDebouncedBaseStudies(
        { ...searchCriteria, flat: true, info: false },
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

    const handleSearch = (searchArgs: Partial<SearchCriteria>) => {
        // when we search, we want to reset the search criteria as we dont know the
        // page number of number of results in advance
        const searchURL = getURLFromSearchCriteria(searchArgs);
        navigate(`/projects/${projectId}/curation/import?${searchURL}`);
    };

    const handleRowsPerPageChange = (newRowsPerPage: number) => {
        const searchURL = addKVPToSearch(
            addKVPToSearch(location.search, 'pageSize', `${newRowsPerPage}`),
            'pageOfResults',
            '1'
        );
        navigate(`/projects/${projectId}/curation/import?${searchURL}`);
    };

    const handlePageChange = (page: number) => {
        const searchURL = addKVPToSearch(location.search, 'pageOfResults', `${page}`);
        navigate(`/projects/${projectId}/curation/import?${searchURL}`);
    };

    const handleButtonClick = async (button: ENavigationButton) => {
        if (button === ENavigationButton.PREV) {
            props.onNavigate(button);
            return;
        }
        setImportIsLoading(true);
        try {
            const allDataForSearch = await baseStudiesSearchHelper({
                ...searchCriteria,
                pageOfResults: 1,
                pageSize: 29999,
                info: false,
            });
            const dataResults = allDataForSearch?.data?.results || [];
            if (dataResults.length !== studyData?.metadata?.total_count)
                throw new Error('search result and query result do not match');
            const newStubs = studiesToStubs(
                location?.search,
                allDataForSearch?.data?.results || []
            );
            setImportIsLoading(false);
            props.onImportStubs(newStubs);
        } catch (e) {
            console.error(e);
            setImportIsLoading(false);
            enqueueSnackbar('There was an error importing studies', { variant: 'error' });
        }
    };

    const tableIsLoading = isLoading || isFetching;

    return (
        <StateHandlerComponent isLoading={false} isError={isError}>
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
                tablePaginationSelectorStyles={{ marginBottom: '80px' }}
            >
                <Box sx={{ marginBottom: '1rem' }}>
                    <NeurosynthTable
                        tableConfig={{
                            isLoading: tableIsLoading,
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
                                        <Box sx={{ color: 'warning.dark' }}>No Journal</Box>
                                    )}
                                </TableCell>
                                <TableCell>{studyrow?.username || 'Neurosynth-Compose'}</TableCell>
                            </TableRow>
                        ))}
                    />
                </Box>
            </SearchContainer>

            <Box sx={CurationImportBaseStyles.fixedContainer}>
                <Box sx={CurationImportBaseStyles.fixedButtonsContainer}>
                    <Button
                        variant="outlined"
                        onClick={() => handleButtonClick(ENavigationButton.PREV)}
                    >
                        back
                    </Button>
                    <LoadingButton
                        variant="contained"
                        text={`Import ${
                            studyData?.metadata?.total_count || 0
                        } studies from neurostore`}
                        onClick={() => handleButtonClick(ENavigationButton.NEXT)}
                        disableElevation
                        sx={{ width: '400px' }}
                        disabled={(studyData?.metadata?.total_count || 0) === 0}
                        loaderColor="secondary"
                        isLoading={importIsLoading}
                    ></LoadingButton>
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};

export default CurationImportNeurostoreSearch;
