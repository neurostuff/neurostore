import { Paper, InputBase, Button, FormControl, Select, MenuItem, Box } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import React, { useEffect, useState } from 'react';
import SearchBarStyles from './SearchBar.styles';
import { SearchBy } from 'pages/Studies/PublicStudiesPage/PublicStudiesPage';
import { useLocation } from 'react-router-dom';
import { extractSearchedStringFromURL } from 'pages/helpers/utils';

export interface ISearchBar {
    onSearch: (searchedString: string, searchBy: SearchBy) => void;
    searchButtonColor?: string;
}

const SearchBar: React.FC<ISearchBar> = (props) => {
    const location = useLocation();

    useEffect(() => {
        setSearchBarParams(extractSearchedStringFromURL(location.search));
    }, [location.search]);

    // state of the search bar
    const [searchBarParams, setSearchBarParams] = useState<{
        searchedString: string;
        searchBy: SearchBy;
    }>(extractSearchedStringFromURL(location.search));

    const handleOnSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        props.onSearch(searchBarParams.searchedString, searchBarParams.searchBy);
    };

    return (
        <Box data-tour="PublicStudiesPage-2" sx={{ display: 'flex' }}>
            <Box component="form" sx={{ width: '100%' }} onSubmit={handleOnSubmit}>
                <Box sx={SearchBarStyles.searchContainer}>
                    <FormControl variant="outlined">
                        <Select
                            sx={SearchBarStyles.select}
                            autoWidth
                            value={searchBarParams.searchBy}
                            onChange={(event) =>
                                setSearchBarParams((prev) => ({
                                    ...prev,
                                    searchBy: event.target.value as SearchBy,
                                }))
                            }
                        >
                            <MenuItem value={SearchBy.ALL}>All</MenuItem>
                            <MenuItem value={SearchBy.NAME}>Title</MenuItem>
                            <MenuItem value={SearchBy.AUTHORS}>Authors</MenuItem>
                            <MenuItem value={SearchBy.DESCRIPTION}>Description</MenuItem>
                        </Select>
                    </FormControl>
                    <Paper sx={SearchBarStyles.paper} variant="outlined">
                        <InputBase
                            value={searchBarParams.searchedString}
                            onChange={(event) =>
                                setSearchBarParams((prev) => ({
                                    ...prev,
                                    searchedString: event.target.value as string,
                                }))
                            }
                            placeholder="Search for a study"
                            sx={SearchBarStyles.textfield}
                        />
                    </Paper>
                    <Button
                        sx={[
                            SearchBarStyles.iconContainer,
                            { backgroundColor: props.searchButtonColor || 'primary' },
                        ]}
                        variant="contained"
                        onClick={handleOnSubmit}
                        size="large"
                        type="submit"
                    >
                        <SearchIcon sx={{ color: 'white' }} />
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default SearchBar;
