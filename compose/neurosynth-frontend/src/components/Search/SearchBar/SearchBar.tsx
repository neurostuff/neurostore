import { Button, Box, Chip, InputBase, Paper } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import {
    SearchBy,
    SearchByMapping,
    SearchCriteria,
    SearchDataType,
    SortBy,
    Source,
} from 'pages/Studies/StudiesPage/models';
import SearchIcon from '@mui/icons-material/Search';
import SimpleSearch from './SimpleSearch/SimpleSearch';
import AdvancedSearch from './AdvancedSearch/AdvancedSearch';
import { useLocation } from 'react-router-dom';
import { getSearchCriteriaFromURL } from 'pages/helpers/utils';
import { ArrowDropDown, Add } from '@mui/icons-material';
import SimpleSearchStyles from './SimpleSearch/SimpleSearch.styles';
import SearchBarStyles from 'components/Search/SearchBar/SearchBar.styles';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import SearchSelectChip from './SearchSelectChip/SearchSelectChip';

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
        // onSearch({
        //     [SearchByMapping[searchBarParams.searchBy]]: searchBarParams.searchedString,
        // });
    };

    const handleChangeSearchParams = (searchArgs: Partial<SearchCriteria>) => {
        onSearch(searchArgs);
    };

    return (
        <Box sx={{ display: 'flex', margin: '1rem 0' }}>
            <Box sx={{ flexGrow: 1 }}>
                <Box data-tour="StudiesPage-2" sx={{ display: 'flex' }}>
                    <Box component="form" sx={{ width: '100%' }} onSubmit={handleOnSubmit}>
                        <Box sx={SearchBarStyles.searchContainer}>
                            <Paper sx={SearchBarStyles.paper} variant="outlined">
                                <InputBase
                                    value={searchState.genericSearchStr}
                                    onChange={(event) =>
                                        handleChangeSearchParams({
                                            genericSearchStr: event.target.value as string,
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
                                    borderTopLeftRadius: 0,
                                    borderBottomLeftRadius: 0,
                                    backgroundColor: searchButtonColor,
                                }}
                                variant="contained"
                            >
                                <SearchIcon />
                            </Button>
                        </Box>
                        <Box sx={{ marginTop: '5px' }}>
                            <SearchSelectChip
                                chipLabel={`Study Data Type: ${searchState.dataType || ''}`}
                                onSelectSearch={(selectedDataType) =>
                                    onSearch({ dataType: selectedDataType })
                                }
                                options={[
                                    { value: SearchDataType.ALL, label: 'All' },
                                    { value: SearchDataType.COORDINATE, label: 'Coordinates' },
                                    { value: SearchDataType.IMAGE, label: 'Images' },
                                ]}
                            />
                            <Chip
                                color="primary"
                                variant="outlined"
                                clickable
                                icon={<ArrowDropDown />}
                                sx={{ marginLeft: '5px' }}
                                label="Studies Source: Neuroquery"
                            />
                            <Chip
                                clickable
                                icon={<ArrowDropDown />}
                                color="info"
                                sx={{ marginLeft: '5px' }}
                                label="SORT BY: Date Created ASC"
                            />
                            <Button
                                color="secondary"
                                sx={{ marginTop: '5px', marginLeft: '10px' }}
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
