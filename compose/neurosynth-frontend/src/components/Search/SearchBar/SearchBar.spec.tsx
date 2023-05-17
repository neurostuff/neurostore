import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SearchBar from './SearchBar';

describe('SearchBar Component', () => {
    const onSearchMock = jest.fn();

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(
            <BrowserRouter>
                <SearchBar onSearch={onSearchMock} />
            </BrowserRouter>
        );

        const searchBar = screen.getByRole('textbox');
        expect(searchBar).toBeInTheDocument();
    });

    it('should input text', () => {
        // ARRANGE
        render(
            <BrowserRouter>
                <SearchBar onSearch={onSearchMock} />
            </BrowserRouter>
        );

        const searchBar = screen.getByPlaceholderText('Search for a study');
        // ACT
        userEvent.type(searchBar, 'ABCDEF');

        // ASSERT
        expect(screen.getByDisplayValue('ABCDEF')).toBeInTheDocument();
    });

    it('should select an option', () => {
        // ARRANGE
        render(
            <BrowserRouter>
                <SearchBar onSearch={onSearchMock} />
            </BrowserRouter>
        );

        // ACT

        // click on the select
        const selectBox = screen.getByRole('button', { name: 'All' });
        userEvent.click(selectBox);

        // select the authors option
        const authors = screen.getByRole('option', { name: 'Authors' });
        userEvent.click(authors);

        // ASSERT
        expect(screen.queryByRole('button', { name: 'Authors' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Authors' })).toBeVisible();
    });

    it('should invoke a search when clicked', () => {
        render(
            <BrowserRouter>
                <SearchBar onSearch={onSearchMock} />
            </BrowserRouter>
        );

        const searchBar = screen.getByPlaceholderText('Search for a study');
        userEvent.type(searchBar, 'ABCDEF');

        const searchButton = screen.getByTestId('SearchIcon');
        userEvent.click(searchButton);
        expect(onSearchMock).toBeCalledWith({ genericSearchStr: 'ABCDEF' });
    });

    it('should invoke a search when enter is pressed', () => {
        render(
            <BrowserRouter>
                <SearchBar onSearch={onSearchMock} />
            </BrowserRouter>
        );

        // click on the select
        const selectBox = screen.getByRole('button', { name: 'All' });
        userEvent.click(selectBox);

        // select the authors option
        const authors = screen.getByRole('option', { name: 'Authors' });
        userEvent.click(authors);

        const searchBar = screen.getByPlaceholderText('Search for a study');
        userEvent.type(searchBar, 'ABCDEF{enter}');

        expect(onSearchMock).toBeCalled();
    });

    it('should color the search button with the given styling', () => {
        render(
            <BrowserRouter>
                <SearchBar searchButtonColor="#FFFFFF" onSearch={onSearchMock} />
            </BrowserRouter>
        );

        const button = screen.getByTestId('SearchIcon');
        expect(button.parentElement).toHaveStyle({ backgroundColor: '#FFFFFF' });
    });
});
