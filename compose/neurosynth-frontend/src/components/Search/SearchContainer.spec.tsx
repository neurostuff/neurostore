import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudiesSearchContainer from './StudiesSearchContainer';

vi.mock('components/Search/StudiesSearchHeader');

vi.mock('@mui/material', async (props: any) => ({
    ...(await vi.importActual('@mui/material')),
    Pagination: (props: any) => (
        <>
            <span>page: {props.page}</span>
            <span>count: {props.count}</span>
            <span data-testid="mock-pagination-styles">styles: {JSON.stringify(props.sx)}</span>
            <button data-testid="trigger-right-paginate" onClick={props.onChange(undefined, 2)}></button>
            <button data-testid="trigger-set-page" onClick={props.onChange(undefined, 5)}></button>
        </>
    ),
    TablePagination: (props: any) => (
        <>
            <span>rows per page: {props.rowsPerPage}</span>
            <button
                data-testid="trigger-rows-per-page-change"
                onClick={props.onRowsPerPageChange({ target: { value: 25 } }, 25)}
            ></button>
        </>
    ),
}));

describe('StudiesSearchContainer Component', () => {
    const mockOnPageChange = vi.fn();
    const mockOnRowsPerPageChange = vi.fn();
    const mockOnSearch = vi.fn();

    it('should render', () => {
        render(
            <StudiesSearchContainer
                totalCount={0}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </StudiesSearchContainer>
        );

        expect(screen.getByText('hello hello hello')).toBeInTheDocument();
    });

    it('should call the search function', () => {
        render(
            <StudiesSearchContainer
                totalCount={0}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </StudiesSearchContainer>
        );
        const search = screen.getByTestId('trigger-search');
        userEvent.click(search);

        expect(mockOnSearch).toHaveBeenCalledWith({ genericSearchStr: 'searchedstring' });
    });

    it('should call the on page change function', () => {
        render(
            <StudiesSearchContainer
                totalCount={100}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </StudiesSearchContainer>
        );

        const muiNavigateRightButton = screen.getByTestId('trigger-right-paginate');
        userEvent.click(muiNavigateRightButton);

        expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    it('should call the on rows per page change function', async () => {
        render(
            <StudiesSearchContainer
                totalCount={100}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </StudiesSearchContainer>
        );
        userEvent.click(screen.getByTestId('trigger-rows-per-page-change'));
        expect(mockOnRowsPerPageChange).toHaveBeenCalledWith(25);
    });

    it('should set the total count', () => {
        render(
            <StudiesSearchContainer
                totalCount={101}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </StudiesSearchContainer>
        );

        expect(screen.getByText('count: 11'));
    });

    it('should set the rows per page', () => {
        render(
            <StudiesSearchContainer
                totalCount={101}
                pageOfResults={1}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </StudiesSearchContainer>
        );

        expect(screen.getByText('rows per page: 10'));
    });

    it('should set the page of results', () => {
        render(
            <StudiesSearchContainer
                totalCount={101}
                pageOfResults={4}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
            >
                <div>hello hello hello</div>
            </StudiesSearchContainer>
        );

        expect('page: 4');
    });

    it('should set the search button color', () => {
        render(
            <StudiesSearchContainer
                totalCount={101}
                pageOfResults={4}
                pageSize={10}
                onPageChange={mockOnPageChange}
                onRowsPerPageChange={mockOnRowsPerPageChange}
                onSearch={mockOnSearch}
                searchButtonColor="yellow"
            >
                <div>hello hello hello</div>
            </StudiesSearchContainer>
        );

        const searchButton = screen.getByTestId('trigger-search');
        expect(searchButton).toHaveStyle('background-color: rgb(255, 255, 0)');
    });

    it('should set the pagination selector styles', () => {
        render(
            <StudiesSearchContainer
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
            </StudiesSearchContainer>
        );

        expect(screen.getByTestId('mock-pagination-styles')).toHaveTextContent(
            '".test-class":{"backgroundColor":"yellow"}'
        );
    });
});
