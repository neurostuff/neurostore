import SearchIcon from '@mui/icons-material/Search';
import { Alert, Box, Button, InputBase, Paper } from '@mui/material';
import SearchBarStyles from 'components/Search/SearchBar.styles';
import {
    EMapType,
    SearchCriteria,
    SearchDataType,
    SearchDataTypeEnumToString,
    SortBy,
    SortByEnumToString,
    Source,
    STUDY_SORT_OPTIONS,
} from 'pages/Study/Study.types';
import { getSearchCriteriaFromURL } from 'components/Search/search.helpers';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SearchBarFilters from './SearchBarFilters';
import SearchFilterChip from './SearchFilterChip';
import SearchSelectSortChip from './SearchSelectSortChip';
import { SearchBy, SearchByMapping } from 'components/Search/search.types';
import { EAnalysisType } from 'hooks/projects/Project.types';

const searchPlaceholderExamples = [
    'Try: smoking -marijuana',
    'Try: fmri AND pain',
    'Try: emotional pain',
    'Try: adolescents OR children OR infants',
    'Try: "working memory" OR "spatial memory"',
];

export interface IStudiesSearchHeader {
    onSearch: (searchArgs: Partial<SearchCriteria>) => void;
    searchButtonColor?: string;
    error?: string;
    analysisType?: EAnalysisType;
}

const StudiesSearchHeader: React.FC<IStudiesSearchHeader> = ({ onSearch, searchButtonColor = 'primary', error }) => {
    const [placeholder, setPlaceholder] = useState(searchPlaceholderExamples[0]);
    const location = useLocation();

    const [searchState, setSearchState] = useState<Partial<SearchCriteria>>({
        genericSearchStr: undefined,
        dataType: SearchDataType.ALL,
        source: Source.ALL,
        sortBy: SortBy.RELEVANCE,
        descOrder: true,
        nameSearch: undefined,
        descriptionSearch: undefined,
        journalSearch: undefined,
        authorSearch: undefined,
        IBMAMapType: EMapType.ANY,
    });

    useEffect(() => {
        setPlaceholder(searchPlaceholderExamples[Math.floor(Math.random() * searchPlaceholderExamples.length)]);
    }, []);

    useEffect(() => {
        const searchCriteria = getSearchCriteriaFromURL(location.search);
        setSearchState({
            genericSearchStr: searchCriteria.genericSearchStr,
            dataType: searchCriteria.dataType || SearchDataType.COORDINATE,
            source: searchCriteria.source || Source.ALL,
            sortBy: searchCriteria.sortBy || SortBy.RELEVANCE,
            descOrder: searchCriteria.descOrder,
            nameSearch: searchCriteria.nameSearch,
            descriptionSearch: searchCriteria.descriptionSearch,
            journalSearch: searchCriteria.journalSearch,
            authorSearch: searchCriteria.authorSearch,
            IBMAMapType: searchCriteria.IBMAMapType || EMapType.ANY,
        });
    }, [location.search]);

    const handleReset = () => {
        onSearch({
            genericSearchStr: undefined,
            dataType: SearchDataType.ALL,
            source: Source.ALL,
            sortBy: SortBy.RELEVANCE,
            descOrder: true,
            nameSearch: undefined,
            descriptionSearch: undefined,
            journalSearch: undefined,
            authorSearch: undefined,
            IBMAMapType: EMapType.ANY,
        });
    };

    const handleOnSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onSearch(searchState);
    };

    const handleAddFilter = (newFilter: { filter: SearchBy; value: string }) => {
        onSearch({
            ...searchState,
            [SearchByMapping[newFilter.filter]]: newFilter.value,
        });
    };

    const handleRemoveFilter = (filterToRemove: { filter: SearchBy; value: string }) => {
        onSearch({
            ...searchState,
            [SearchByMapping[filterToRemove.filter]]: undefined,
        });
    };

    return (
        <Box sx={{ display: 'flex', margin: '1rem 0' }}>
            <Box sx={{ flexGrow: 1 }}>
                <Box component="form" sx={{ width: '100%' }} onSubmit={handleOnSubmit}>
                    <Box sx={SearchBarStyles.searchContainer}>
                        <Paper sx={SearchBarStyles.paper} variant="outlined">
                            <InputBase
                                value={searchState.genericSearchStr || ''}
                                onChange={(event) =>
                                    setSearchState((prev) => ({
                                        ...prev,
                                        genericSearchStr: event.target.value as string,
                                    }))
                                }
                                placeholder={placeholder}
                                sx={SearchBarStyles.textfield}
                            />
                        </Paper>
                        <Button
                            disableElevation
                            type="submit"
                            sx={{
                                borderTopLeftRadius: '0px',
                                borderBottomLeftRadius: '0px',
                                backgroundColor: searchButtonColor,
                                width: '150px',
                            }}
                            variant="contained"
                            startIcon={<SearchIcon />}
                        >
                            Search
                        </Button>
                        <Button
                            onClick={handleReset}
                            sx={{
                                borderTopLeftRadius: '0px',
                                borderBottomLeftRadius: '0px',
                                borderLeft: '0px !important',
                                width: '100px',
                                color: searchButtonColor,
                            }}
                            disableElevation
                            variant="text"
                        >
                            Reset
                        </Button>
                    </Box>
                    {error && (
                        <Alert
                            style={{
                                borderTopLeftRadius: 0,
                                borderTopRightRadius: 0,
                                width: `calc(100% - 150px + 18px)`,
                            }}
                            severity="error"
                        >
                            {error}
                        </Alert>
                    )}
                </Box>
                <Box sx={{ marginTop: '10px' }}>
                    <SearchFilterChip
                        chipLabel={`Study Data Type: ${
                            SearchDataTypeEnumToString[searchState.dataType as SearchDataType]
                        }`}
                        onSelectSearch={(selectedDataType) =>
                            onSearch({
                                ...searchState,
                                dataType: selectedDataType,
                                IBMAMapType: selectedDataType === SearchDataType.COORDINATE ? undefined : EMapType.ANY,
                            })
                        }
                        options={[
                            { value: SearchDataType.ALL, label: 'All' },
                            { value: SearchDataType.COORDINATE, label: 'Coordinates' },
                            { value: SearchDataType.IMAGE, label: 'Images' },
                        ]}
                    />
                    {searchState.dataType === SearchDataType.IMAGE && (
                        <SearchFilterChip
                            chipLabel={`Map Type: ${searchState.IBMAMapType}`}
                            onSelectSearch={(selectedMapType) =>
                                onSearch({ ...searchState, IBMAMapType: selectedMapType })
                            }
                            options={Object.values(EMapType).map((mapType) => ({
                                value: mapType,
                                label: `${mapType} Map`,
                            }))}
                        />
                    )}
                    <SearchSelectSortChip
                        options={STUDY_SORT_OPTIONS}
                        chipLabel={`Sort By: ${SortByEnumToString[searchState.sortBy as SortBy]}`}
                        descOrderChipLabel={searchState.descOrder ? 'DESC' : 'ASC'}
                        onSelectDescOrder={(descOrder) => onSearch({ ...searchState, descOrder })}
                        onSelectSort={(sortBy) => onSearch({ ...searchState, sortBy })}
                    />
                    <SearchBarFilters
                        searchMode="study-search"
                        nameSearch={searchState.nameSearch}
                        descriptionSearch={searchState.descriptionSearch}
                        journalSearch={searchState.journalSearch}
                        authorSearch={searchState.authorSearch}
                        onAddFilter={handleAddFilter}
                        onRemoveFilter={handleRemoveFilter}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default StudiesSearchHeader;
