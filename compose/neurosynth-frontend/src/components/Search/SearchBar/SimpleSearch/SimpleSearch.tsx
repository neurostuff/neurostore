import { Box, FormControl, Select, InputBase, Paper, MenuItem, Button } from '@mui/material';
import { getSearchCriteriaFromURL } from 'pages/helpers/utils';
import { SearchBy, SearchByMapping } from 'pages/Studies/StudiesPage/StudiesPage';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ISearchBar } from '../SearchBar';
import SearchIcon from '@mui/icons-material/Search';
import SimpleSearchStyles from './SimpleSearch.styles';

const SimpleSearch: React.FC<ISearchBar> = (props) => {
    const location = useLocation();

    useEffect(() => {
        const searchCriteria = getSearchCriteriaFromURL(location.search);
        if (searchCriteria.genericSearchStr) {
            setSearchBarParams({
                searchedString: searchCriteria.genericSearchStr,
                searchBy: SearchBy.ALL,
            });
        } else if (searchCriteria.nameSearch) {
            setSearchBarParams({
                searchedString: searchCriteria.nameSearch,
                searchBy: SearchBy.TITLE,
            });
        } else if (searchCriteria.descriptionSearch) {
            setSearchBarParams({
                searchedString: searchCriteria.descriptionSearch,
                searchBy: SearchBy.DESCRIPTION,
            });
        } else if (searchCriteria.authorSearch) {
            setSearchBarParams({
                searchedString: searchCriteria.authorSearch,
                searchBy: SearchBy.AUTHORS,
            });
        }
    }, [location.search]);

    const [searchBarParams, setSearchBarParams] = useState<{
        searchedString: string;
        searchBy: SearchBy;
    }>({
        searchedString: '',
        searchBy: SearchBy.ALL,
    });

    const handleOnSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        props.onSearch({
            [SearchByMapping[searchBarParams.searchBy]]: searchBarParams.searchedString,
        });
    };

    return (
        <Box data-tour="StudiesPage-2" sx={{ display: 'flex' }}>
            <Box component="form" sx={{ width: '100%' }} onSubmit={handleOnSubmit}>
                <Box sx={SimpleSearchStyles.searchContainer}>
                    <FormControl variant="outlined">
                        <Select
                            sx={SimpleSearchStyles.select}
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
                            <MenuItem value={SearchBy.TITLE}>Title</MenuItem>
                            <MenuItem value={SearchBy.AUTHORS}>Authors</MenuItem>
                            <MenuItem value={SearchBy.DESCRIPTION}>Description</MenuItem>
                        </Select>
                    </FormControl>
                    <Paper sx={SimpleSearchStyles.paper} variant="outlined">
                        <InputBase
                            value={searchBarParams.searchedString}
                            onChange={(event) =>
                                setSearchBarParams((prev) => ({
                                    ...prev,
                                    searchedString: event.target.value as string,
                                }))
                            }
                            placeholder="Search for a study"
                            sx={SimpleSearchStyles.textfield}
                        />
                    </Paper>
                    <Button
                        type="submit"
                        sx={{
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                            backgroundColor: props.searchButtonColor,
                        }}
                        variant="contained"
                    >
                        <SearchIcon />
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default SimpleSearch;
