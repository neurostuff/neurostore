import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, InputBase, Paper } from '@mui/material';
import SearchBarStyles from 'components/Search/SearchBar/SearchBar.styles';
import {
    SearchBy,
    SearchByMapping,
    SearchCriteria,
    SearchDataType,
    SearchDataTypeEnumToString,
    SortBy,
    SortByEnumToString,
    Source,
} from 'pages/Studies/StudiesPage/models';
import { getSearchCriteriaFromURL } from 'pages/helpers/utils';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SearchBarFilters from './SearchBarAccessories/SearchBarFilters';
import SearchSelectChip from './SearchBarAccessories/SearchSelectChip';
import SearchSelectSortChip from './SearchBarAccessories/SearchSelectSortChip';
import { ProjectSearchCriteria } from 'hooks/projects/useGetProjects';

export interface ISearchBar {
    onSearch: (searchArgs: Partial<SearchCriteria | ProjectSearchCriteria>) => void;
    searchButtonColor?: string;
    searchMode?: 'study-search' | 'project-search';
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

    const [searchState, setSearchState] = useState<Partial<ProjectSearchCriteria | SearchCriteria>>(
        searchMode === 'study-search'
            ? {
                  genericSearchStr: undefined, // this defaults to undefined if empty in useGetBaseStudies
                  dataType: SearchDataType.ALL,
                  source: Source.ALL,
                  sortBy: SortBy.RELEVANCE,
                  descOrder: true,
                  nameSearch: undefined, // this defaults to undefined if empty in useGetBaseStudies
                  descriptionSearch: undefined, // this defaults to undefined if empty in useGetBaseStudies
                  journalSearch: undefined, // this defaults to undefined if empty in useGetBaseStudies
                  authorSearch: undefined,
              }
            : {
                  nameSearch: '',
                  genericSearchStr: '',
                  descriptionSearch: '',
                  sortBy: SortBy.LASTUPDATED,
                  descOrder: true,
              }
    );

    // set new placeholder on reload
    useEffect(() => {
        if (searchMode === 'study-search') {
            const placeholder =
                searchPlaceholderExamples[
                    Math.floor(Math.random() * searchPlaceholderExamples.length)
                ];
            setPlaceholder(placeholder);
        } else {
            setPlaceholder('Enter a project name...');
        }
    }, [searchMode]);

    useEffect(() => {
        if (searchMode === 'study-search') {
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
            } as SearchCriteria);
        } else {
            const searchCriteria = getSearchCriteriaFromURL(location.search);
            setSearchState({
                genericSearchStr: searchCriteria.genericSearchStr,
                sortBy: searchCriteria.sortBy || SortBy.LASTUPDATED,
                descOrder: searchCriteria.descOrder,
                nameSearch: searchCriteria.nameSearch,
                descriptionSearch: searchCriteria.descriptionSearch,
            } as ProjectSearchCriteria);
        }
    }, [location.search, searchMode]);

    const handleReset = () => {
        if (searchMode === 'study-search') {
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
            return;
        }
        onSearch({
            nameSearch: undefined,
            genericSearchStr: undefined,
            descriptionSearch: undefined,
            sortBy: SortBy.LASTUPDATED,
            descOrder: true,
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
                    {searchMode === 'study-search' ? (
                        <Box sx={{ marginTop: '10px' }}>
                            <SearchSelectChip
                                chipLabel={`Study Data Type: ${
                                    SearchDataTypeEnumToString[
                                        (searchState as SearchCriteria).dataType as SearchDataType
                                    ]
                                }`}
                                onSelectSearch={(selectedDataType) =>
                                    onSearch({
                                        ...(searchState as SearchCriteria),
                                        dataType: selectedDataType,
                                    })
                                }
                                options={[
                                    { value: SearchDataType.ALL, label: 'All' },
                                    { value: SearchDataType.COORDINATE, label: 'Coordinates' },
                                    { value: SearchDataType.IMAGE, label: 'Images' },
                                ]}
                            />
                            <SearchSelectSortChip
                                searchMode="study-search"
                                chipLabel={`Sort By: ${
                                    SortByEnumToString[
                                        (searchState as SearchCriteria).sortBy as SortBy
                                    ]
                                }`}
                                descOrderChipLabel={
                                    (searchState as SearchCriteria).descOrder ? 'DESC' : 'ASC'
                                }
                                onSelectDescOrder={(descOrder) =>
                                    onSearch({ ...(searchState as SearchCriteria), descOrder })
                                }
                                onSelectSort={(sortBy) =>
                                    onSearch({ ...(searchState as SearchCriteria), sortBy })
                                }
                            />
                            <SearchBarFilters
                                searchMode="study-search"
                                nameSearch={(searchState as SearchCriteria).nameSearch}
                                descriptionSearch={
                                    (searchState as SearchCriteria).descriptionSearch
                                }
                                journalSearch={(searchState as SearchCriteria).journalSearch}
                                authorSearch={(searchState as SearchCriteria).authorSearch}
                                onAddFilter={handleAddFilter}
                                onRemoveFilter={handleRemoveFilter}
                            />
                        </Box>
                    ) : (
                        <Box sx={{ marginTop: '10px' }}>
                            <SearchSelectSortChip
                                searchMode="project-search"
                                chipLabel={`Sort By: ${
                                    SortByEnumToString[
                                        (searchState as ProjectSearchCriteria).sortBy as SortBy
                                    ]
                                }`}
                                descOrderChipLabel={
                                    (searchState as ProjectSearchCriteria).descOrder
                                        ? 'DESC'
                                        : 'ASC'
                                }
                                onSelectDescOrder={(descOrder) =>
                                    onSearch({
                                        ...(searchState as ProjectSearchCriteria),
                                        descOrder,
                                    })
                                }
                                onSelectSort={(sortBy) =>
                                    onSearch({ ...(searchState as ProjectSearchCriteria), sortBy })
                                }
                            />
                            <SearchBarFilters
                                searchMode="project-search"
                                nameSearch={(searchState as ProjectSearchCriteria).nameSearch}
                                descriptionSearch={
                                    (searchState as ProjectSearchCriteria).descriptionSearch
                                }
                                journalSearchAllowed={false}
                                authorSearchAllowed={false}
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
