import { ISearchBar } from '../SearchBar';

const mockSearchBar = (props: ISearchBar) => {
    return (
        <button
            style={{ backgroundColor: props.searchButtonColor }}
            data-testid="trigger-search"
            onClick={() => props.onSearch({ genericSearchStr: 'searchedstring' })}
        ></button>
    );
};

export default mockSearchBar;
