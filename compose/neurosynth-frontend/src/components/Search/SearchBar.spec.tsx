import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from './SearchBar';

vi.mock('react-router-dom');
describe('SearchBar Component', () => {
    const onSearchMock = vi.fn();

    afterAll(() => {
        vi.clearAllMocks();
    });

    it('should render', () => {
        render(<SearchBar onSearch={onSearchMock} />);

        const searchBar = screen.getByRole('textbox');
        expect(searchBar).toBeInTheDocument();
    });

    it('should input text', () => {
        // ARRANGE
        render(<SearchBar onSearch={onSearchMock} />);

        const searchBar = screen.getByRole('textbox');
        userEvent.type(searchBar, 'ABCDEF');

        // ASSERT
        expect(screen.getByDisplayValue('ABCDEF')).toBeInTheDocument();
    });

    it('should invoke a search when clicked', () => {
        render(<SearchBar onSearch={onSearchMock} />);

        const searchBar = screen.getByRole('textbox');
        userEvent.type(searchBar, 'ABCDEF');

        const searchButton = screen.getByTestId('SearchIcon');
        userEvent.click(searchButton);
        expect(onSearchMock).toBeCalledWith({
            authorSearch: undefined,
            dataType: expect.any(String),
            descOrder: expect.any(Boolean),
            descriptionSearch: undefined,
            nameSearch: undefined,
            journalSearch: undefined,
            sortBy: expect.any(String),
            source: expect.any(String),
            genericSearchStr: 'ABCDEF', // this is the thing we care about and want to test
        });
    });

    it('should invoke a search when enter is pressed', () => {
        render(<SearchBar onSearch={onSearchMock} />);

        const searchBar = screen.getByRole('textbox');
        userEvent.type(searchBar, 'ABCDEF{enter}');

        expect(onSearchMock).toBeCalled();
    });

    it('should color the search button with the given styling', () => {
        render(<SearchBar searchButtonColor="#FFFFFF" onSearch={onSearchMock} />);

        const button = screen.getByTestId('SearchIcon');
        expect(button.parentElement).toHaveStyle({ backgroundColor: 'rgb(255, 255, 255);' }); // equivalent to '#FFFFFF', dont forget semicolon
    });

    it('should show the error when there is one', () => {
        render(<SearchBar error="there is an error" onSearch={onSearchMock} />);
        expect(screen.getByText('there is an error')).toBeInTheDocument();
    });
});
