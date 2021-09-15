import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '..';

describe('SearchBar Component', () => {
    const onSearchMock = jest.fn();

    it('should render', () => {
        render(<SearchBar onSearch={onSearchMock} />);

        const searchBar = screen.getByRole('textbox');
        expect(searchBar).toBeInTheDocument();
    });

    it('should invoke a search when text is entered', () => {
        render(<SearchBar onSearch={onSearchMock} />);
        const searchedText = 'some search test';
        const searchBar = screen.getByRole('textbox');
        userEvent.type(searchBar, searchedText);
        const searchButton = screen.getByRole('button');
        userEvent.click(searchButton);
        expect(onSearchMock).toBeCalledWith(searchedText);
    });
});
