import { ConditionReturn } from 'neurostore-typescript-sdk';

export const MockConditionSelected = {
    name: 'mock-selected-condition-name',
    description: 'mock-selected-condition-description',
    id: 'mock-id-1',
    created_at: '',
    user: 'github|user-1',
};

const mockConditionSelector: React.FC<{
    onConditionSelected: (condition: ConditionReturn) => void;
}> = (props) => {
    return (
        <button
            data-testid="mock-condition-selector"
            onClick={(_event) => props.onConditionSelected(MockConditionSelected)}
        ></button>
    );
};

export default mockConditionSelector;
