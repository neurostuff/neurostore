import { Box, FormControl, Select, InputBase, Paper, MenuItem, Button, Chip } from '@mui/material';
import { getSearchCriteriaFromURL } from 'pages/helpers/utils';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ISearchBar } from '../SearchBar';
import SearchIcon from '@mui/icons-material/Search';
import SimpleSearchStyles from './SimpleSearch.styles';
import { SearchBy, SearchByMapping } from 'pages/Studies/StudiesPage/models';
import { Add, ArrowDropDown } from '@mui/icons-material';

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
                    <Paper sx={SimpleSearchStyles.paper} variant="outlined">
                        <InputBase
                            value={searchBarParams.searchedString}
                            onChange={(event) =>
                                setSearchBarParams((prev) => ({
                                    ...prev,
                                    searchedString: event.target.value as string,
                                }))
                            }
                            placeholder='Try "Emotion" or "FMRI AND EMOTION" -PAIN'
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
                <Box sx={{ marginTop: '5px' }}>
                    <Chip
                        color="primary"
                        variant="outlined"
                        clickable
                        icon={<ArrowDropDown />}
                        sx={{ marginLeft: '5px' }}
                        label="Data Type: ALL"
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
    );
};

export default SimpleSearch;
