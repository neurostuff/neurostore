import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, InputBase, Paper } from '@mui/material';
import SearchBarStyles from 'components/Search/SearchBar.styles';
import { PROJECT_SORT_OPTIONS, SortBy, SortByEnumToString } from 'pages/Study/Study.types';
import { getSearchCriteriaFromURL } from 'components/Search/search.helpers';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SearchBarFilters from './SearchBarFilters';
import SearchSelectSortChip from './SearchSelectSortChip';
import { ProjectSearchCriteria } from 'hooks/projects/useGetProjects';
import { SearchBy, SearchByMapping } from 'components/Search/search.types';

export interface IProjectSearchHeader {
    onSearch: (searchArgs: Partial<ProjectSearchCriteria>) => void;
    searchButtonColor?: string;
}

const ProjectSearchHeader: React.FC<IProjectSearchHeader> = (props) => {
    const { onSearch, searchButtonColor = 'primary' } = props;
    const location = useLocation();

    const [searchState, setSearchState] = useState<Partial<ProjectSearchCriteria>>({
        nameSearch: '',
        genericSearchStr: '',
        descriptionSearch: '',
        sortBy: SortBy.LASTUPDATED,
        descOrder: true,
    });

    useEffect(() => {
        const searchCriteria = getSearchCriteriaFromURL(location.search);
        setSearchState({
            genericSearchStr: searchCriteria.genericSearchStr,
            sortBy: searchCriteria.sortBy || SortBy.LASTUPDATED,
            descOrder: searchCriteria.descOrder,
            nameSearch: searchCriteria.nameSearch,
            descriptionSearch: searchCriteria.descriptionSearch,
        });
    }, [location.search]);

    const handleReset = () => {
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
                                placeholder="Enter a project name..."
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
                <Box sx={{ marginTop: '10px' }}>
                    <SearchSelectSortChip
                        options={PROJECT_SORT_OPTIONS}
                        chipLabel={`Sort By: ${SortByEnumToString[searchState.sortBy as SortBy]}`}
                        descOrderChipLabel={searchState.descOrder ? 'DESC' : 'ASC'}
                        onSelectDescOrder={(descOrder) => onSearch({ ...searchState, descOrder })}
                        onSelectSort={(sortBy) => onSearch({ ...searchState, sortBy })}
                    />
                    <SearchBarFilters
                        searchMode="project-search"
                        nameSearch={searchState.nameSearch}
                        descriptionSearch={searchState.descriptionSearch}
                        journalSearchAllowed={false}
                        authorSearchAllowed={false}
                        onAddFilter={handleAddFilter}
                        onRemoveFilter={handleRemoveFilter}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default ProjectSearchHeader;
