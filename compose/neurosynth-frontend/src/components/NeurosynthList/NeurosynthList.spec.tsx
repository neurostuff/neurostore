import { render, screen } from '@testing-library/react';
import NeurosynthList from './NeurosynthList';
import ArticleIcon from '@mui/icons-material/Article';

vi.mock('react-router-dom');

describe('NeurosynthList Component', () => {
    const mockListItems = [
        {
            primaryText: 'primary-1',
            secondaryText: 'secondary-2',
            link: '/some-url-1',
            id: 'id-1',
        },
        {
            primaryText: 'primary-2',
            secondaryText: 'secondary-2',
            link: '/some-url-2',
            id: 'id-2',
        },
        {
            primaryText: 'primary-3',
            secondaryText: 'secondary-3',
            link: '/some-url-3',
            id: 'id-3',
        },
    ];

    it('should render', () => {
        render(<NeurosynthList listItems={mockListItems} />);
    });

    it('should have the correct number of items', () => {
        render(<NeurosynthList listItems={mockListItems} />);
        expect(screen.getAllByRole('listitem').length).toEqual(mockListItems.length);
    });

    it('should show the title text', () => {
        render(<NeurosynthList listItems={mockListItems} titleText="test-title-text" />);
        expect(screen.getByText('test-title-text')).toBeInTheDocument();
    });

    it('should render the correct icon for each listitem', () => {
        render(<NeurosynthList listIcon={<ArticleIcon />} listItems={mockListItems} />);
        expect(screen.getAllByTestId('ArticleIcon').length).toEqual(mockListItems.length);
    });

    it('should load', () => {
        render(<NeurosynthList listItems={mockListItems} isLoading={true} />);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show an error', () => {
        render(<NeurosynthList listItems={mockListItems} isError={true} />);
        expect(screen.getByText('There was an error')).toBeInTheDocument();
    });

    it('should show no data', () => {
        render(<NeurosynthList listItems={[]} NoDataElement={<>no data here</>} />);
        expect(screen.getByText('no data here')).toBeInTheDocument();
    });

    it('should show the custom title element', () => {
        render(<NeurosynthList listItems={[]} TitleElement={<button>test-title-button</button>} />);
        expect(screen.getByText('test-title-button')).toBeInTheDocument();
    });
});
