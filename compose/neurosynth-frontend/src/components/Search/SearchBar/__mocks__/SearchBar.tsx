import { SearchBy } from 'pages/Studies/StudiesPage/StudiesPage';
import { ISearchBar } from '../SearchBar';

const mockSearchBar: React.FC<ISearchBar> = (props) => {
    return (
        <button
            data-testid="trigger-search"
            // onClick={() => props.onSearch('searchedstring', SearchBy.ALL)}
        ></button>
    );
};

export default mockSearchBar;
