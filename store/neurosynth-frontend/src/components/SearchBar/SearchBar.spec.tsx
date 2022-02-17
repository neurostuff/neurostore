import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchCriteria } from '../../pages/Studies/PublicStudiesPage/PublicStudiesPage';
import SearchBar from './SearchBar';

describe('SearchBar Component', () => {
    const onSearchMock = jest.fn();

    it('should render', () => {
        render(<SearchBar onSearch={onSearchMock} />);

        const searchBar = screen.getByRole('textbox');
        expect(searchBar).toBeInTheDocument();
    });

    it('should select an option and call have that option set when search is invoked', () => {
        render(<SearchBar onSearch={onSearchMock} />);

        const searchedText = 'some searched text';
        const mockSearchCriteria = new SearchCriteria();
        mockSearchCriteria.authorSearch = searchedText;

        // enter text into the searchbar
        const searchBar = screen.getByPlaceholderText('Search for a study');
        userEvent.type(searchBar, searchedText);

        // click on the select
        const selectBox = screen.getByText('All');
        userEvent.click(selectBox);

        // select the authors option
        const authors = screen.getByText('Authors');
        userEvent.click(authors);

        // click on the search button to invoke the search
        const searchButton = screen.getByRole('button', { name: '' });
        userEvent.click(searchButton);

        expect(onSearchMock).toBeCalledWith(mockSearchCriteria);
    });

    it('should invoke a search when clicked', () => {
        render(<SearchBar onSearch={onSearchMock} />);
        const searchedText = 'some search test';

        const mockSearchCriteria = new SearchCriteria();
        mockSearchCriteria.genericSearchStr = searchedText;

        const searchBar = screen.getByPlaceholderText('Search for a study');
        userEvent.type(searchBar, searchedText);
        const searchButton = screen.getByRole('button', { name: '' });
        userEvent.click(searchButton);
        expect(onSearchMock).toBeCalledWith(mockSearchCriteria);
    });

    it('should invoke a search when enter is pressed', () => {
        render(<SearchBar onSearch={onSearchMock} />);
        const searchedText = 'some search test';

        const mockSearchCriteria = new SearchCriteria();
        mockSearchCriteria.genericSearchStr = searchedText;

        const searchBar = screen.getByPlaceholderText('Search for a study');
        userEvent.type(searchBar, `${searchedText}{enter}`);
        expect(onSearchMock).toBeCalledWith(mockSearchCriteria);
    });
});
