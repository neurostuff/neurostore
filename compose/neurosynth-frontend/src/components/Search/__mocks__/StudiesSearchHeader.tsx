import { IStudiesSearchHeader } from '../StudiesSearchHeader';

const mockStudiesSearchHeader: React.FC<IStudiesSearchHeader> = (props) => {
    return (
        <button
            style={{ backgroundColor: props.searchButtonColor }}
            data-testid="trigger-search"
            onClick={() => props.onSearch({ genericSearchStr: 'searchedstring' })}
        ></button>
    );
};

export default mockStudiesSearchHeader;
