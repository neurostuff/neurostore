import { ConditionApiResponse } from 'utils/api';

export const MockConditionSelected = {
    name: 'mock-selected-condition-name',
    description: 'mock-selected-condition-description',
    id: 'mock-id-1',
    created_at: '',
    user: 'github|user-1',
};

const mockConditionSelector: React.FC<{
    onConditionSelected: (condition: ConditionApiResponse) => void;
}> = (props) => {
    return (
        <button
            data-testid="mock-condition-selector"
            onClick={(_event) => props.onConditionSelected(MockConditionSelected)}
        ></button>
    );
};

export default mockConditionSelector;
