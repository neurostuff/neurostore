import { ISearchBar } from '../SearchBar';

const mockSearchBar: React.FC<ISearchBar> = (props) => {
    return (
        <button
            style={{ backgroundColor: props.searchButtonColor }}
            data-testid="trigger-search"
            onClick={() => props.onSearch({ genericSearchStr: 'searchedstring' })}
        ></button>
    );
};

export default mockSearchBar;
