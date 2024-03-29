import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, InputBase, Paper } from '@mui/material';
import SearchBarStyles from 'components/Search/SearchBar/SearchBar.styles';
import {
    SearchBy,
    SearchByMapping,
    SearchCriteria,
    SearchDataType,
    SortBy,
    Source,
} from 'pages/Studies/StudiesPage/models';
import { getSearchCriteriaFromURL } from 'pages/helpers/utils';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SearchBarFilters from './SearchBarAccessories/SearchBarFilters';
import SearchSelectChip from './SearchBarAccessories/SearchSelectChip';
import SearchSelectSortChip from './SearchBarAccessories/SearchSelectSortChip';

export interface ISearchBar {
    onSearch: (searchArgs: Partial<SearchCriteria>) => void;
    searchButtonColor?: string;
    searchMode?: 'study-search' | 'studyset-search';
}

const searchPlaceholderExamples = [
    'Try: smoking -marijuana',
    'Try: fmri AND pain',
    'Try: emotional pain',
    'Try: adolescents OR children OR infants',
    'Try: "working memory" OR "spatial memory"',
];

const SearchBar: React.FC<ISearchBar> = (props) => {
    const { onSearch, searchButtonColor = 'primary', searchMode = 'study-search' } = props;
    const [placeholder, setPlaceholder] = useState(searchPlaceholderExamples[0]);
    const location = useLocation();

    const [searchState, setSearchState] = useState<Partial<SearchCriteria>>({
        genericSearchStr: undefined, // this defaults to undefined if empty in useGetBaseStudies
        dataType: SearchDataType.ALL,
        source: Source.ALL,
        sortBy: SortBy.RELEVANCE,
        descOrder: true,
        nameSearch: undefined, // this defaults to undefined if empty in useGetBaseStudies
        descriptionSearch: undefined, // this defaults to undefined if empty in useGetBaseStudies
        journalSearch: undefined, // this defaults to undefined if empty in useGetBaseStudies
        authorSearch: undefined,
    });

    // set new placeholder on reload
    useEffect(() => {
        if (searchMode === 'study-search') {
            const placeholder =
                searchPlaceholderExamples[
                    Math.floor(Math.random() * searchPlaceholderExamples.length)
                ];
            setPlaceholder(placeholder);
        } else {
            setPlaceholder('Enter a studyset name...');
        }
    }, [searchMode]);

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
                <Box data-tour="StudiesPage-2">
                    <Box component="form" sx={{ width: '100%' }} onSubmit={handleOnSubmit}>
                        <Box sx={SearchBarStyles.searchContainer}>
                            <Paper sx={SearchBarStyles.paper} variant="outlined">
                                <InputBase
                                    value={searchState.genericSearchStr || ''}
                                    onChange={(event) =>
                                        setSearchState((prev) => {
                                            return {
                                                ...prev,
                                                genericSearchStr: event.target.value as string,
                                            };
                                        })
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
                    </Box>
                    {searchMode === 'study-search' && (
                        <Box sx={{ marginTop: '10px' }}>
                            <SearchSelectChip
                                chipLabel={`Study Data Type: ${searchState.dataType || ''}`}
                                onSelectSearch={(selectedDataType) =>
                                    onSearch({ ...searchState, dataType: selectedDataType })
                                }
                                options={[
                                    { value: SearchDataType.ALL, label: 'All' },
                                    { value: SearchDataType.COORDINATE, label: 'Coordinates' },
                                    { value: SearchDataType.IMAGE, label: 'Images' },
                                ]}
                            />
                            <SearchSelectSortChip
                                chipLabel={`Sort By: ${searchState.sortBy}`}
                                descOrderChipLabel={searchState.descOrder ? 'DESC' : 'ASC'}
                                onSelectDescOrder={(descOrder) =>
                                    onSearch({ ...searchState, descOrder })
                                }
                                onSelectSort={(sortBy) => onSearch({ ...searchState, sortBy })}
                            />
                            <SearchBarFilters
                                nameSearch={searchState.nameSearch}
                                descriptionSearch={searchState.descriptionSearch}
                                journalSearch={searchState.journalSearch}
                                authorSearch={searchState.authorSearch}
                                onAddFilter={handleAddFilter}
                                onRemoveFilter={handleRemoveFilter}
                            />
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default SearchBar;
