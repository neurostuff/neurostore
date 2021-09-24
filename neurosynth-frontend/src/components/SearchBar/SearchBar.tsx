import {
    Paper,
    InputBase,
    Button,
    FormControl,
    Select,
    MenuItem,
    SelectChangeEvent,
    IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
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

    const classes = SearchBarStyles();
    return (
        <div style={{ display: 'flex' }}>
            <form className={classes.w_100} onSubmit={handleOnSubmit}>
                <div className={classes.searchContainer}>
                    <FormControl variant="outlined">
                        <Select
                            className={classes.select}
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
                    <Paper className={classes.paper} variant="outlined">
                        <InputBase
                            onChange={handleEnteredText}
                            placeholder="Search for a study"
                            className={classes.textfield}
                        />
                    </Paper>
                    <Button
                        color="primary"
                        variant="contained"
                        className={classes.iconContainer}
                        onClick={handleOnSubmit}
                        size="large"
                        type="submit"
                    >
                        <SearchIcon className={classes.icon} />
                    </Button>
                </div>
            </form>
            {/* <IconButton style={{ width: '80px' }}>
                <SettingsIcon style={{ fontSize: '2.5rem' }} />
            </IconButton> */}
        </div>
    );
};

export default SearchBar;
