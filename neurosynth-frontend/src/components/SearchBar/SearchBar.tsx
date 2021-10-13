import {
    Paper,
    InputBase,
    Button,
    FormControl,
    Select,
    MenuItem,
    SelectChangeEvent,
    Box,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import React from 'react';
import { useState } from 'react';
import SearchBarStyles from './SearchBarStyles';
import { SearchCriteria } from '../../pages/StudiesPage/StudiesPage';

enum SearchBy {
    NAME = 'nameSearch',
    DESCRIPTION = 'descriptionSearch',
    AUTHORS = 'authorSearch',
    ALL = 'genericSearchStr',
}

export interface SearchBarModel {
    onSearch: (arg: SearchCriteria) => void;
}

const SearchBar: React.FC<SearchBarModel> = (props) => {
    const [searchParams, setSearchParams] = useState<{
        searchedString: string;
        searchBy: SearchBy;
    }>({
        searchedString: '',
        searchBy: SearchBy.ALL,
    });

    const handleOnSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        const newSearch = new SearchCriteria();
        newSearch[searchParams.searchBy] = searchParams.searchedString;
        props.onSearch(newSearch);
    };

    const handleEnteredText = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchParams((prevState) => {
            return {
                ...prevState,
                searchedString: event.target.value,
            };
        });
    };

    const handleSelectChange = (event: SelectChangeEvent<string>, child: React.ReactNode) => {
        setSearchParams((prevState) => {
            return {
                ...prevState,
                searchBy: event.target.value as SearchBy,
            };
        });
    };

    return (
        <Box sx={{ display: 'flex' }}>
            <Box component="form" sx={{ width: '100%' }} onSubmit={handleOnSubmit}>
                <Box sx={SearchBarStyles.searchContainer}>
                    <FormControl variant="outlined">
                        <Select
                            sx={SearchBarStyles.select}
                            autoWidth
                            value={searchParams.searchBy}
                            onChange={handleSelectChange}
                        >
                            <MenuItem value={SearchBy.ALL}>All</MenuItem>
                            <MenuItem value={SearchBy.NAME}>Title</MenuItem>
                            <MenuItem value={SearchBy.AUTHORS}>Authors</MenuItem>
                            <MenuItem value={SearchBy.DESCRIPTION}>Description</MenuItem>
                        </Select>
                    </FormControl>
                    <Paper sx={SearchBarStyles.paper} variant="outlined">
                        <InputBase
                            onChange={handleEnteredText}
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
