import { Box, Pagination, TablePagination, Typography } from '@mui/material';
import StudiesSearchHeader from 'components/Search/StudiesSearchHeader';
import { getNumTotalPages } from 'components/Search/search.helpers';
import { IStudiesSearchContainer } from 'components/Search/search.types';
import { ChangeEvent } from 'react';
import SearchContainerStyles from './SearchContainer.styles';

const StudiesSearchContainer: React.FC<IStudiesSearchContainer> = (props) => {
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
        error = undefined,
    } = props;

    const handleRowsPerPageChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newRowsPerPage = parseInt(event.target.value);
        if (!isNaN(newRowsPerPage)) onRowsPerPageChange(newRowsPerPage);
    };

    const handlePaginationChange = (page: number) => {
        if (page === null) return;
        onPageChange(page);
    };

    return (
        <>
            <StudiesSearchHeader error={error} searchButtonColor={searchButtonColor} onSearch={onSearch} />

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
                page={totalCount === undefined ? 0 : pageOfResults - 1}
                count={totalCount || 0}
                sx={[SearchContainerStyles.paginator, tablePaginationSelectorStyles]}
            />
        </>
    );
};

export default StudiesSearchContainer;
