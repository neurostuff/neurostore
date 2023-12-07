import { Box, Pagination, TablePagination, Typography } from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import SearchBar from 'components/Search/SearchBar/SearchBar';
import { SearchCriteria } from 'pages/Studies/StudiesPage/models';
import { ChangeEvent } from 'react';
import SearchContainerStyles from './SearchContainer.styles';

export interface ISearchContainer {
    onPageChange: (newPage: number) => void;
    onRowsPerPageChange: (newRowsPerPage: number) => void;
    onSearch: (searchArgs: Partial<SearchCriteria>) => void;
    totalCount: number | undefined;
    pageSize: number;
    pageOfResults: number;
    searchButtonColor?: string;
    paginationSelectorStyles?: SystemStyleObject;
    tablePaginationSelectorStyles?: SystemStyleObject;
    searchMode?: 'study-search' | 'studyset-search';
}

const getNumTotalPages = (totalCount: number | undefined, pageSize: number | undefined) => {
    if (!totalCount || !pageSize) {
        return 0;
    }
    const numTotalPages = Math.trunc(totalCount / pageSize);
    const remainder = totalCount % pageSize;
    return remainder > 0 ? numTotalPages + 1 : numTotalPages;
};

const SearchContainer: React.FC<ISearchContainer> = (props) => {
    const {
        onPageChange,
        onRowsPerPageChange,
        onSearch,
        pageOfResults,
        totalCount,
        pageSize,
        children,
        searchButtonColor = 'primary',
        paginationSelectorStyles = {},
        tablePaginationSelectorStyles = {},
        searchMode = 'study-search',
    } = props;

    const handleRowsPerPageChange = (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const newRowsPerPage = parseInt(event.target.value);
        if (!isNaN(newRowsPerPage)) onRowsPerPageChange(newRowsPerPage);
    };

    const handlePaginationChange = (page: number) => {
        if (page === null) return;
        onPageChange(page);
    };

    return (
        <>
            <SearchBar
                searchMode={searchMode}
                searchButtonColor={searchButtonColor}
                onSearch={onSearch}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Pagination
                    siblingCount={2}
                    boundaryCount={2}
                    sx={[SearchContainerStyles.paginator, paginationSelectorStyles]}
                    onChange={(_event, page) => handlePaginationChange(page)}
                    showFirstButton
                    showLastButton
                    page={totalCount === undefined ? 0 : pageOfResults}
                    count={getNumTotalPages(totalCount, pageSize)}
                />
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h6">{totalCount} results</Typography>
                </Box>
            </Box>
            {children}
            <TablePagination
                rowsPerPage={pageSize}
                onRowsPerPageChange={handleRowsPerPageChange}
                onPageChange={(_event, page) => handlePaginationChange(page + 1)}
                component="div"
                rowsPerPageOptions={[10, 25, 50, 99]}
                // we have to do this because MUI's pagination component starts at 0,
                // whereas 0 and 1 are the same in the backend
                page={totalCount === undefined ? 0 : pageOfResults - 1}
                count={totalCount || 0}
                sx={[SearchContainerStyles.paginator, tablePaginationSelectorStyles]}
            />
        </>
    );
};

export default SearchContainer;
