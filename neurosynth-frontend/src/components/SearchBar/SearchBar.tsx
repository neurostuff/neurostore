import { Paper, InputBase, Divider, IconButton } from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import React from 'react';
import { useState } from 'react';
import SearchBarStyles from './SearchBarStyles';

export interface SearchBarModel {
    onSearch: (arg: string) => void;
}

const SearchBar: React.FC<SearchBarModel> = (props) => {
    const [enteredText, setEnteredText] = useState('');

    const handleOnSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        const searchTerm = enteredText;
        props.onSearch(searchTerm);
    };

    const handleEnteredText = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEnteredText(event.target.value);
    };

    const classes = SearchBarStyles();
    return (
        <form onSubmit={handleOnSubmit}>
            <Paper className={classes.paper}>
                <InputBase
                    onChange={handleEnteredText}
                    placeholder="Search for a study"
                    className={classes.textfield}
                />
                <Divider className={classes.divider} orientation="vertical" />
                <IconButton className={classes.icon} onClick={handleOnSubmit}>
                    <SearchIcon color="primary" />
                </IconButton>
            </Paper>
        </form>
    );
};

export default SearchBar;
