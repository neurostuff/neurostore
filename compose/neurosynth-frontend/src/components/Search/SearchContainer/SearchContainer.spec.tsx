import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchContainer from './SearchContainer';

jest.mock('components/Search/SearchBar/SearchBar.tsx');

jest.mock('@mui/material/Pagination', () => {
    return {
        __esModule: true,
        default: (props: any) => {
            return (
                <>
                    <span>page: {props.page}</span>
                    <span>count: {props.count}</span>
                    <span data-testid="mock-pagination-styles">
                        styles: {JSON.stringify(props.sx)}
                    </span>
                    <button
                        data-testid="trigger-right-paginate"
                        onClick={props.onChange(undefined, 2)}
                    ></button>
                    <button
                        data-testid="trigger-set-page"
                        onClick={props.onChange(undefined, 5)}
                    ></button>
                </>
            );
        },
    };
});

jest.mock('@mui/material/TablePagination', () => {
    return {
        __esModule: true,
        default: (props: any) => {
            return (
                <>
                    <span>rows per page: {props.rowsPerPage}</span>
                    <button
                        data-testid="trigger-rows-per-page-change"
                        onClick={props.onRowsPerPageChange({ target: { value: 25 } }, 25)}
                    ></button>
                </>
            );
        },
    };
});

describe('SearchContainer Component', () => {
    const mockOnPageChange = jest.fn();
    const mockOnRowsPerPageChange = jest.fn();
    const mockOnSearch = jest.fn();

    it('should render', () => {
        render(
            <SearchContainer
                totalCount={0}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </SearchContainer>
        );

        expect(screen.getByText('hello hello hello')).toBeInTheDocument();
    });

    it('should call the search function', () => {
        render(
            <SearchContainer
                totalCount={0}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </SearchContainer>
        );
        const search = screen.getByTestId('trigger-search');
        userEvent.click(search);

        expect(mockOnSearch).toHaveBeenCalledWith({ genericSearchStr: 'searchedstring' });
    });

    it('should call the on page change function', () => {
        render(
            <SearchContainer
                totalCount={100}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </SearchContainer>
        );

        const muiNavigateRightButton = screen.getByTestId('trigger-right-paginate');
        userEvent.click(muiNavigateRightButton);

        expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    it('should call the on rows per page change function', async () => {
        render(
            <SearchContainer
                totalCount={100}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </SearchContainer>
        );
        userEvent.click(screen.getByTestId('trigger-rows-per-page-change'));
        expect(mockOnRowsPerPageChange).toHaveBeenCalledWith(25);
    });

    it('should set the total count', () => {
        render(
            <SearchContainer
                totalCount={101}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </SearchContainer>
        );

        expect(screen.getByText('count: 11'));
    });

    it('should set the rows per page', () => {
        render(
            <SearchContainer
                totalCount={101}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </SearchContainer>
        );

        expect(screen.getByText('rows per page: 10'));
    });

    it('should set the page of results', () => {
        render(
            <SearchContainer
                totalCount={101}
                pageOfResults={4}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </SearchContainer>
        );

        expect('page: 4');
    });

    it('should set the search button color', () => {
        render(
            <SearchContainer
                totalCount={101}
                pageOfResults={4}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
                searchButtonColor="yellow"
            >
                <div>hello hello hello</div>
            </SearchContainer>
        );

        const searchButton = screen.getByTestId('trigger-search');
        expect(searchButton).toHaveStyle('background-color: yellow');
    });

    it('should set the pagination selector styles', () => {
        render(
            <SearchContainer
                totalCount={101}
                pageOfResults={4}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
                paginationSelectorStyles={{
                    '.test-class': {
                        backgroundColor: 'yellow',
                    },
                }}
            >
                <div>hello hello hello</div>
            </SearchContainer>
        );

        expect(screen.getByTestId('mock-pagination-styles')).toHaveTextContent(
            '".test-class":{"backgroundColor":"yellow"}'
        );
    });
});
