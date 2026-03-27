import { Box, Button, TableCell, TableRow } from '@mui/material';
import { AxiosError } from 'axios';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import NeurosynthTable from 'components/NeurosynthTable/NeurosynthTable';
import NeurosynthTableStyles from 'components/NeurosynthTable/NeurosynthTable.styles';
import { addKVPToSearch, getSearchCriteriaFromURL, getURLFromSearchCriteria } from 'components/Search/search.helpers';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { studiesToStubs } from 'helpers/Curation.helpers';
import { baseStudiesSearchHelper } from 'hooks/studies/useGetBaseStudies';
import { BaseStudyList } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useProjectAnalysisType, useProjectId } from 'pages/Project/store/ProjectStore';
import { SearchCriteria, SearchDataType } from 'pages/Study/Study.types';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CurationImportStyles from '../CurationImport.styles';
import { IImportArgs } from './ImportDoImport';
import LoadingButton from 'components/Buttons/LoadingButton';
import { EAnalysisType } from 'hooks/projects/Project.types';
import StudiesSearchContainer from 'components/Search/StudiesSearchContainer';

const SearchNeurostore: React.FC<IImportArgs & { onSetSearchCriteria: (searchCriteria: SearchCriteria) => void }> = (
    props
) => {
    const [importIsLoading, setImportIsLoading] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>();

    const navigate = useNavigate();
    const location = useLocation();
    const projectId = useProjectId();
    const projectAnalysisType = useProjectAnalysisType();

    // cached data returned from the api
    const [studyData, setStudyData] = useState<BaseStudyList>();

    const searchCriteria: SearchCriteria = useMemo(() => {
        return {
            ...new SearchCriteria(),
            ...getSearchCriteriaFromURL(location?.search),
            ...(projectAnalysisType === EAnalysisType.IBMA ? { dataType: SearchDataType.IMAGE } : {}),
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
        navigate(`/projects/${projectId}/curation/search?${searchURL}`);
    };

    const handleRowsPerPageChange = (newRowsPerPage: number) => {
        const searchURL = addKVPToSearch(
            addKVPToSearch(location.search, 'pageSize', `${newRowsPerPage}`),
            'pageOfResults',
            '1'
        );
        navigate(`/projects/${projectId}/curation/search?${searchURL}`);
    };

    const handlePageChange = (page: number) => {
        const searchURL = addKVPToSearch(location.search, 'pageOfResults', `${page}`);
        navigate(`/projects/${projectId}/curation/search?${searchURL}`);
    };

    const handleButtonClick = async (button: ENavigationButton) => {
        if (isLoading) return;

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
            <StudiesSearchContainer
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
                                <TableCell
                                    sx={{
                                        maxWidth: '300px !important',
                                        overflow: 'hidden !important',
                                        textOverflow: 'ellipsis !important',
                                        whiteSpace: 'nowrap !important',
                                    }}
                                >
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
            </StudiesSearchContainer>

            <Box sx={CurationImportStyles.actionsContainer}>
                <Button
                    variant="outlined"
                    color="error"
                    sx={CurationImportStyles.actionsButton}
                    onClick={() => handleButtonClick(ENavigationButton.PREV)}
                >
                    cancel
                </Button>
                <LoadingButton
                    variant="contained"
                    color="primary"
                    sx={CurationImportStyles.actionsButton}
                    onClick={() => handleButtonClick(ENavigationButton.NEXT)}
                    text="next"
                    loaderColor="secondary"
                    disableElevation
                    disabled={(studyData?.metadata?.total_count || 0) === 0 || !hasSearch || isLoading || !!error}
                    isLoading={importIsLoading}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default SearchNeurostore;
