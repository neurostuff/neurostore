import { Button, Box } from '@mui/material';
import React, { useState } from 'react';
import { SearchCriteria } from 'pages/Studies/StudiesPage/StudiesPage';
import SimpleSearch from './SimpleSearch/SimpleSearch';
import AdvancedSearch from './AdvancedSearch/AdvancedSearch';
import { useLocation } from 'react-router-dom';
import { getSearchCriteriaFromURL } from 'pages/helpers/utils';

export interface ISearchBar {
    onSearch: (searchArgs: Partial<SearchCriteria>) => void;
    searchButtonColor?: string;
}

const hasMultipleSearchCriteria = (search?: string) => {
    const searchCriteria = getSearchCriteriaFromURL(search);
    return (
        +!!searchCriteria.authorSearch +
            +!!searchCriteria.descriptionSearch +
            +!!searchCriteria.genericSearchStr +
            +!!searchCriteria.nameSearch >
        1
    );
};

const SearchBar: React.FC<ISearchBar> = (props) => {
    const { onSearch, searchButtonColor = 'primary' } = props;
    const location = useLocation();
    const [advancedSearch, setAdvancedSearch] = useState(
        hasMultipleSearchCriteria(location.search)
    );

    const handleOnSearch = (searchArgs: Partial<SearchCriteria>) => {
        onSearch(searchArgs);
    };

    return (
        <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
            <Box sx={{ flexGrow: 1 }}>
                {advancedSearch ? (
                    <AdvancedSearch
                        searchButtonColor={searchButtonColor}
                        onSearch={handleOnSearch}
                    />
                ) : (
                    <SimpleSearch searchButtonColor={searchButtonColor} onSearch={handleOnSearch} />
                )}
            </Box>
            <Box>
                <Button
                    onClick={() => setAdvancedSearch((prev) => !prev)}
                    variant="outlined"
                    sx={{
                        marginLeft: '20px',
                        borderColor: searchButtonColor,
                        height: '54px',
                        width: '166px',
                        color: searchButtonColor,
                    }}
                >
                    {advancedSearch ? 'Simple' : 'Advanced'} Search
                </Button>
            </Box>
        </Box>
    );
};

export default SearchBar;
