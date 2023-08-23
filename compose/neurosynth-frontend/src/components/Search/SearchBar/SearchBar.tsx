import { Add, ArrowDropDown } from '@mui/icons-material';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, Chip, InputBase, Paper } from '@mui/material';
import SearchBarStyles from 'components/Search/SearchBar/SearchBar.styles';
import { SearchCriteria, SearchDataType, SortBy, Source } from 'pages/Studies/StudiesPage/models';
import { getSearchCriteriaFromURL } from 'pages/helpers/utils';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SearchSelectChip from './SearchBarChip/SearchSelectChip';
import SearchSelectSortChip from './SearchBarChip/SearchSelectSortChip';

export interface ISearchBar {
    onSearch: (searchArgs: Partial<SearchCriteria>) => void;
    searchButtonColor?: string;
}

const SearchBar: React.FC<ISearchBar> = (props) => {
    const { onSearch, searchButtonColor = 'primary' } = props;
    const location = useLocation();

    const [searchState, setSearchState] = useState<Partial<SearchCriteria>>({
        genericSearchStr: '',
        dataType: SearchDataType.COORDINATE,
        source: Source.ALL,
        sortBy: SortBy.TITLE,
        descOrder: true,
    });

    useEffect(() => {
        const searchCriteria = getSearchCriteriaFromURL(location.search);

        setSearchState({
            genericSearchStr: searchCriteria.genericSearchStr,
            dataType: searchCriteria.dataType || SearchDataType.COORDINATE,
            source: searchCriteria.source || Source.ALL,
            sortBy: searchCriteria.sortBy || SortBy.TITLE,
            descOrder: searchCriteria.descOrder,
        });
    }, [location.search]);

    const handleOnSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onSearch(searchState);
    };

    return (
        <Box sx={{ display: 'flex', margin: '1rem 0' }}>
            <Box sx={{ flexGrow: 1 }}>
                <Box data-tour="StudiesPage-2" sx={{ display: 'flex' }}>
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
                                    placeholder='Try "Emotion" or "FMRI AND EMOTION" -PAIN'
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
                                sx={{
                                    borderTopLeftRadius: '0px',
                                    borderBottomLeftRadius: '0px',
                                    borderLeft: '0px !important',
                                    width: '100px',
                                }}
                                disableElevation
                                color="primary"
                                variant="text"
                            >
                                Reset
                            </Button>
                        </Box>
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
                            <Button
                                color="secondary"
                                sx={{ marginLeft: '10px' }}
                                startIcon={<Add />}
                            >
                                Add Filter
                            </Button>
                        </Box>
                    </Box>
                </Box>
                {/* {advancedSearch ? (
                    <AdvancedSearch
                        searchButtonColor={searchButtonColor}
                        onSearch={handleOnSearch}
                    />
                ) : (
                    <SimpleSearch searchButtonColor={searchButtonColor} onSearch={handleOnSearch} />
                )} */}
            </Box>
            {/* <Box>
                <Button
                    onClick={() => setAdvancedSearch((prev) => !prev)}
                    variant="outlined"
                    sx={{
                        marginLeft: '20px',
                        borderColor: searchButtonColor,
                        height: '52px',
                        width: '166px',
                        color: searchButtonColor,
                    }}
                >
                    {advancedSearch ? 'Simple' : 'Advanced'} Search
                </Button>
            </Box> */}
        </Box>
    );
};

export default SearchBar;
