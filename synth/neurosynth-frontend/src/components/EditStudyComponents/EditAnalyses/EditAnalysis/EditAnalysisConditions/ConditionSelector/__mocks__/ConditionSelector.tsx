import { ConditionApiResponse } from '../../../../../../../utils/api';

const mockConditionSelector: React.FC<{
    onConditionSelected: (condition: ConditionApiResponse) => void;
}> = (props) => {
    const mockConditionSelected: ConditionApiResponse = {
        name: 'mock-selected-condition-name',
        description: 'mock-selected-condition-description',
        id: 'mock-id-1',
        created_at: '',
        user: 'github|user-1',
    };

    return (
        <button
            data-testid="mock-condition-selector"
            onClick={(_event) => props.onConditionSelected(mockConditionSelected)}
        ></button>
    );
};

export default mockConditionSelector;
