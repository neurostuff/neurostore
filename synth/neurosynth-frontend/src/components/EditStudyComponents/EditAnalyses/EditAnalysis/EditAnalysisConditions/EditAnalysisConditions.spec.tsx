import { act, render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EAnalysisEdit, EAnalysisEditButtonType } from '../..';
import { ConditionApiResponse } from '../../../../../utils/api';
import EditAnalysisConditions from './EditAnalysisConditions';

jest.mock('./ConditionSelector/ConditionSelector');

describe('EditAnalysisConditions Component', () => {
    let renderResult: RenderResult;
    const mockOnConditionWeightChange = jest.fn();
    const mockOnEditAnalysisButtonPress = jest.fn();

    afterAll(() => {
        jest.clearAllMocks();
    });

    const mockConditions: ConditionApiResponse[] = [
        {
            name: 'name-condition-1',
            description: 'description-condition-1',
            id: 'id-condition-1',
            created_at: '',
            user: 'github|user-1',
        },
    ];

    const mockWeights: number[] = [1];

    beforeEach(() => {
        renderResult = render(
            <EditAnalysisConditions
                updateEnabled={false}
                onConditionWeightChange={mockOnConditionWeightChange}
                onEditAnalysisButtonPress={mockOnEditAnalysisButtonPress}
                conditions={mockConditions}
                weights={mockWeights}
            />
        );
    });

    afterEach(() => {
        mockOnConditionWeightChange.mockClear();
        mockOnEditAnalysisButtonPress.mockClear();
    });

    it('should render', () => {
        const titleText = screen.getByText('Conditions for this analysis');
        expect(titleText).toBeInTheDocument();
    });

    describe('buttons', () => {
        it('should initally have the save button be disabled', () => {
            const saveButton = screen.getByRole('button', { name: 'Save' });
            expect(saveButton).toBeDisabled();
        });

        it('should initially have the cancel button be disabled', () => {
            const cancelButton = screen.getByRole('button', { name: 'Cancel' });
            expect(cancelButton).toBeDisabled();
        });

        it('should enable the save button when update flag is enabled', async () => {
            renderResult.rerender(
                <EditAnalysisConditions
                    updateEnabled={true}
                    onConditionWeightChange={mockOnConditionWeightChange}
                    onEditAnalysisButtonPress={mockOnEditAnalysisButtonPress}
                    conditions={mockConditions}
                    weights={mockWeights}
                />
            );
            const saveButton = screen.getByRole('button', { name: 'Save' });
            expect(saveButton).toBeEnabled();
        });

        it('should enable the cancel button when update flag is enabled', () => {
            renderResult.rerender(
                <EditAnalysisConditions
                    updateEnabled={true}
                    onConditionWeightChange={mockOnConditionWeightChange}
                    onEditAnalysisButtonPress={mockOnEditAnalysisButtonPress}
                    conditions={mockConditions}
                    weights={mockWeights}
                />
            );
            const cancelButton = screen.getByRole('button', { name: 'Cancel' });
            expect(cancelButton).toBeEnabled();
        });
    });

    it('should call the function when a new condition is selected', () => {
        const addConditionButton = screen.getByTestId('mock-condition-selector');
        userEvent.click(addConditionButton);

        expect(mockOnConditionWeightChange).toBeCalledWith(
            [
                ...mockConditions,
                {
                    name: 'mock-selected-condition-name',
                    description: 'mock-selected-condition-description',
                    id: 'mock-id-1',
                    created_at: '',
                    user: 'github|user-1',
                },
            ],
            [1, 1]
        );
    });

    it('should disable the first cell', () => {
        const disabledCell = screen.getAllByRole('cell')[0];
        expect(disabledCell).toHaveClass('readonly');
    });

    it('should update the weight when a cell is updated', async () => {
        const inputCell = screen.getAllByRole('cell')[1];
        await act(async () => {
            userEvent.dblClick(inputCell);
        });
        const input = screen.getByRole('spinbutton');
        userEvent.type(input, '{backspace}0.5');

        await act(async () => {
            userEvent.type(input, '{enter}');
        });
        expect(mockOnConditionWeightChange).toBeCalledWith(mockConditions, [0.5]);
    });

    it('should not update the table if the condition already exists', () => {
        const newMockConditions = [
            {
                name: 'mock-selected-condition-name',
                description: 'mock-selected-condition-description',
                id: 'mock-id-1',
                created_at: '',
                user: 'github|user-1',
            },
        ];

        renderResult.rerender(
            <EditAnalysisConditions
                updateEnabled={false}
                onConditionWeightChange={mockOnConditionWeightChange}
                onEditAnalysisButtonPress={mockOnEditAnalysisButtonPress}
                conditions={newMockConditions}
                weights={mockWeights}
            />
        );

        const addConditionButton = screen.getByTestId('mock-condition-selector');
        userEvent.click(addConditionButton);

        expect(mockOnConditionWeightChange).not.toBeCalled();
    });

    it('should call the function when the delete button is clicked', async () => {
        const deleteButton = screen.getByRole('button', { name: 'Delete' });
        await act(async () => {
            userEvent.click(deleteButton);
        });

        expect(mockOnConditionWeightChange).toBeCalledWith([], []);
    });

    it('should save the state when the save button is clicked', () => {
        renderResult.rerender(
            <EditAnalysisConditions
                updateEnabled={true}
                onConditionWeightChange={mockOnConditionWeightChange}
                onEditAnalysisButtonPress={mockOnEditAnalysisButtonPress}
                conditions={mockConditions}
                weights={mockWeights}
            />
        );

        const saveButton = screen.getByRole('button', { name: 'Save' });
        userEvent.click(saveButton);
        expect(mockOnEditAnalysisButtonPress).toBeCalledWith(
            EAnalysisEdit.CONDITIONS,
            EAnalysisEditButtonType.SAVE
        );
    });

    it('should cancel the changes when the cancel button is clicked', () => {
        renderResult.rerender(
            <EditAnalysisConditions
                updateEnabled={true}
                onConditionWeightChange={mockOnConditionWeightChange}
                onEditAnalysisButtonPress={mockOnEditAnalysisButtonPress}
                conditions={mockConditions}
                weights={mockWeights}
            />
        );

        const saveButton = screen.getByRole('button', { name: 'Cancel' });
        userEvent.click(saveButton);
        expect(mockOnEditAnalysisButtonPress).toBeCalledWith(
            EAnalysisEdit.CONDITIONS,
            EAnalysisEditButtonType.CANCEL
        );
    });

    it('should show the unsaved changes text when there are unsaved changes', () => {
        renderResult.rerender(
            <EditAnalysisConditions
                updateEnabled={true}
                onConditionWeightChange={mockOnConditionWeightChange}
                onEditAnalysisButtonPress={mockOnEditAnalysisButtonPress}
                conditions={mockConditions}
                weights={mockWeights}
            />
        );

        const unsavedChangesText = screen.getByText('unsaved changes');
        expect(unsavedChangesText).toBeInTheDocument();
    });
});
