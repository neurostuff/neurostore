import { Paper, InputBase, Button, FormControl, Select, MenuItem, Box } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import React from 'react';
import SearchBarStyles from './SearchBar.styles';
import { SearchBy } from 'pages/Studies/PublicStudiesPage/PublicStudiesPage';

export interface SearchBarModel {
    searchedString: string;
    searchBy: SearchBy;
    onSearch: (event: React.FormEvent) => void;
    onSearchByChange: (newSearchBy: SearchBy) => void;
    onTextInputChange: (newTextInput: string) => void;
}

const SearchBar: React.FC<SearchBarModel> = (props) => {
    const handleOnSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        props.onSearch(event);
    };

    return (
        <Box data-tour="PublicStudiesPage-2" sx={{ display: 'flex' }}>
            <Box component="form" sx={{ width: '100%' }} onSubmit={handleOnSubmit}>
                <Box sx={SearchBarStyles.searchContainer}>
                    <FormControl variant="outlined">
                        <Select
                            sx={SearchBarStyles.select}
                            autoWidth
                            value={props.searchBy}
                            onChange={(event) =>
                                props.onSearchByChange(event.target.value as SearchBy)
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
                            value={props.searchedString}
                            onChange={(event) => props.onTextInputChange(event.target.value)}
                            placeholder="Search for a study"
                            sx={SearchBarStyles.textfield}
                        />
                    </Paper>
                    <Button
                        sx={SearchBarStyles.iconContainer}
                        color="primary"
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
