import { Box, Button, TableCell, TableRow } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import SearchContainer from 'components/Search/SearchContainer';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import NeurosynthTable from 'components/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/NeurosynthTable/NeurosynthTable.styles';
import { baseStudiesSearchHelper } from 'hooks/studies/useGetBaseStudies';
import { BaseStudyList } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useProjectId } from 'pages/Project/store/ProjectStore';
import { SearchCriteria } from 'pages/Study/Study.types';
import { addKVPToSearch, getSearchCriteriaFromURL, getURLFromSearchCriteria } from 'components/Search/search.helpers';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IImportArgs } from './CurationImportDoImport';
import CurationImportBaseStyles from './CurationImport.styles';
import { studiesToStubs } from 'helpers/Curation.helpers';
import { AxiosError } from 'axios';

const CurationImportNeurostore: React.FC<
    IImportArgs & { onSetSearchCriteria: (searchCriteria: SearchCriteria) => void }
> = (props) => {
    const [importIsLoading, setImportIsLoading] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>();

    const navigate = useNavigate();
    const location = useLocation();
    const projectId = useProjectId();

    // cached data returned from the api
    const [studyData, setStudyData] = useState<BaseStudyList>();

    const searchCriteria: SearchCriteria = useMemo(() => {
        return {
            ...new SearchCriteria(),
            ...getSearchCriteriaFromURL(location?.search),
        };
    }, [location?.search]);

    useEffect(() => {
        setError(undefined);
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
                        if (err.response?.status && err.response.status === 400) {
                            setError(err.response?.data.detail.message);
                        } else {
                            setError('There was an error searching for studies');
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
        if (isLoading) return;

        if (button === ENavigationButton.PREV) {
            navigate(`/projects/${projectId}/curation/import`);
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
            const newStubs = studiesToStubs(allDataForSearch?.data?.results || []);
            setImportIsLoading(false);
            props.onImportStubs(newStubs);
            props.onSetSearchCriteria(searchCriteria);
            props.onNavigate(ENavigationButton.NEXT);
        } catch (e) {
            console.error(e);
            setImportIsLoading(false);
            enqueueSnackbar('There was an error importing studies', { variant: 'error' });
        }
    };

    const hasSearch =
        searchCriteria.authorSearch !== undefined ||
        searchCriteria.descriptionSearch !== undefined ||
        searchCriteria.genericSearchStr !== undefined ||
        searchCriteria.journalSearch !== undefined ||
        searchCriteria.nameSearch !== undefined;

    return (
        <StateHandlerComponent isLoading={false} isError={false}>
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
                tablePaginationSelectorStyles={{ marginBottom: '80px' }}
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
                                    {studyrow?.name || <Box sx={{ color: 'warning.dark' }}>No name</Box>}
                                </TableCell>
                                <TableCell>
                                    {studyrow?.authors || <Box sx={{ color: 'warning.dark' }}>No author(s)</Box>}
                                </TableCell>
                                <TableCell>
                                    {studyrow?.publication || <Box sx={{ color: 'warning.dark' }}>No Journal</Box>}
                                </TableCell>
                                <TableCell>{studyrow?.username || 'Neurosynth-Compose'}</TableCell>
                            </TableRow>
                        ))}
                    />
                </Box>
            </SearchContainer>

            <Box sx={CurationImportBaseStyles.fixedContainer}>
                <Box sx={CurationImportBaseStyles.fixedButtonsContainer}>
                    <Button variant="outlined" onClick={() => handleButtonClick(ENavigationButton.PREV)}>
                        back
                    </Button>
                    <LoadingButton
                        variant="contained"
                        text={`Import ${studyData?.metadata?.total_count || 0} studies from neurostore`}
                        onClick={() => handleButtonClick(ENavigationButton.NEXT)}
                        disableElevation
                        sx={{ width: '400px' }}
                        disabled={(studyData?.metadata?.total_count || 0) === 0 || !hasSearch || isLoading || !!error}
                        loaderColor="secondary"
                        isLoading={importIsLoading}
                    ></LoadingButton>
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};

export default CurationImportNeurostore;
