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

        const searchBar = screen.getByRole('textbox');
        userEvent.type(searchBar, 'ABCDEF');

        // ASSERT
        expect(screen.getByDisplayValue('ABCDEF')).toBeInTheDocument();
    });

    it('should invoke a search when clicked', () => {
        render(
            <BrowserRouter>
                <SearchBar onSearch={onSearchMock} />
            </BrowserRouter>
        );

        const searchBar = screen.getByRole('textbox');
        userEvent.type(searchBar, 'ABCDEF');

        const searchButton = screen.getByTestId('SearchIcon');
        userEvent.click(searchButton);
        expect(onSearchMock).toBeCalledWith({
            authorSearch: expect.any(String),
            dataType: expect.any(String),
            descOrder: expect.any(Boolean),
            descriptionSearch: expect.any(String),
            nameSearch: expect.any(String),
            publicationSearch: expect.any(String),
            sortBy: expect.any(String),
            source: expect.any(String),
            genericSearchStr: 'ABCDEF', // this is the thing we care about and want to test
        });
    });

    it('should invoke a search when enter is pressed', () => {
        render(
            <BrowserRouter>
                <SearchBar onSearch={onSearchMock} />
            </BrowserRouter>
        );

        const searchBar = screen.getByRole('textbox');
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
        expect(button.parentElement).toHaveStyle({ backgroundColor: 'rgb(255, 255, 255);' }); // equivalent to '#FFFFFF', dont forget semicolon
    });
});
