import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBy } from 'pages/Studies/PublicStudiesPage/PublicStudiesPage';
import SearchBar from './SearchBar';

describe('SearchBar Component', () => {
    const onSearchMock = jest.fn();
    const onSearchByChangeMock = jest.fn();
    const onTextInputChangeMock = jest.fn();

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const searchBy = SearchBy.ALL;
        render(
            <SearchBar
                onSearchByChange={onSearchByChangeMock}
                onTextInputChange={onTextInputChangeMock}
                searchedString=""
                searchBy={searchBy}
                onSearch={onSearchMock}
            />
        );

        const searchBar = screen.getByRole('textbox');
        expect(searchBar).toBeInTheDocument();
    });

    it('should input text and call the function', () => {
        // ARRANGE
        const searchBy = SearchBy.ALL;
        render(
            <SearchBar
                onSearchByChange={onSearchByChangeMock}
                onTextInputChange={onTextInputChangeMock}
                searchedString=""
                searchBy={searchBy}
                onSearch={onSearchMock}
            />
        );

        const searchBar = screen.getByPlaceholderText('Search for a study');
        // ACT
        userEvent.type(searchBar, 'A');

        // ASSERT
        expect(onTextInputChangeMock).toHaveBeenCalledWith('A');
    });

    it('should select an option and call the function', () => {
        // ARRANGE
        const searchBy = SearchBy.ALL;
        render(
            <SearchBar
                onSearchByChange={onSearchByChangeMock}
                onTextInputChange={onTextInputChangeMock}
                searchedString=""
                searchBy={searchBy}
                onSearch={onSearchMock}
            />
        );

        // ACT

        // click on the select
        const selectBox = screen.getByRole('button', { name: 'All' });
        userEvent.click(selectBox);

        // select the authors option
        const authors = screen.getByRole('option', { name: 'Authors' });
        userEvent.click(authors);

        // ASSERT
        expect(onSearchByChangeMock).toHaveBeenCalledWith(SearchBy.AUTHORS);
    });

    it('should invoke a search when clicked', () => {
        const searchBy = SearchBy.ALL;
        render(
            <SearchBar
                onSearchByChange={onSearchByChangeMock}
                onTextInputChange={onTextInputChangeMock}
                searchedString="search"
                searchBy={searchBy}
                onSearch={onSearchMock}
            />
        );

        const searchButton = screen.getByTestId('SearchIcon');
        userEvent.click(searchButton);
        expect(onSearchMock).toBeCalled();
    });

    it('should invoke a search when enter is pressed', () => {
        const searchBy = SearchBy.ALL;
        render(
            <SearchBar
                onSearchByChange={onSearchByChangeMock}
                onTextInputChange={onTextInputChangeMock}
                searchedString="search"
                searchBy={searchBy}
                onSearch={onSearchMock}
            />
        );

        const searchBar = screen.getByPlaceholderText('Search for a study');
        userEvent.type(searchBar, `{enter}`);
        expect(onSearchMock).toBeCalled();
    });
});
