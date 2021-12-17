import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateDatasetDialog from './CreateDatasetDialog';

describe('CreateDatasetDialog', () => {
    const mockOnCreateDataset = jest.fn();
    const mockOnCloseDialog = jest.fn();
    it('should render', () => {
        render(
            <CreateDatasetDialog
                isOpen={true}
                onCreateDataset={mockOnCreateDataset}
                onCloseDialog={mockOnCloseDialog}
            />
        );
        const text = screen.getByText('Create new dataset');
        const nameField = screen.getByLabelText('Dataset Name *'); // added to indicate it is required
        const descriptionField = screen.getByLabelText('Dataset Description');
        expect(text).toBeInTheDocument();
        expect(nameField).toBeInTheDocument();
        expect(descriptionField).toBeInTheDocument();
    });

    it('should close when cancel is clicked', () => {
        render(
            <CreateDatasetDialog
                isOpen={true}
                onCreateDataset={mockOnCreateDataset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const closeButton = screen.getByRole('button', { name: 'Cancel' });
        userEvent.click(closeButton);

        expect(mockOnCloseDialog).toBeCalled();
    });

    it('should be disabled', () => {
        render(
            <CreateDatasetDialog
                isOpen={true}
                onCreateDataset={mockOnCreateDataset}
                onCloseDialog={mockOnCloseDialog}
            />
        );
        const createButton = screen.getByRole('button', { name: 'Create' });
        expect(createButton).toBeDisabled();
    });

    it('should update the name textfield when text is entered', () => {
        render(
            <CreateDatasetDialog
                isOpen={true}
                onCreateDataset={mockOnCreateDataset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const nameField = screen.getByLabelText('Dataset Name *');
        userEvent.type(nameField, 'ABC');

        const displayNameFieldText = screen.getByDisplayValue('ABC');
        expect(displayNameFieldText).toBeInTheDocument();
    });

    it('should update the description textfield when text is entered', () => {
        render(
            <CreateDatasetDialog
                isOpen={true}
                onCreateDataset={mockOnCreateDataset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const descriptionField = screen.getByLabelText('Dataset Description');
        userEvent.type(descriptionField, 'ABC');

        const displayDescriptionFieldText = screen.getByDisplayValue('ABC');
        expect(displayDescriptionFieldText).toBeInTheDocument();
    });

    it('should call the create func with the correct data when create is clicked', () => {
        render(
            <CreateDatasetDialog
                isOpen={true}
                onCreateDataset={mockOnCreateDataset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const nameField = screen.getByLabelText('Dataset Name *');
        userEvent.type(nameField, 'ABC');

        const createButton = screen.getByRole('button', { name: 'Create' });
        userEvent.click(createButton);

        expect(mockOnCreateDataset).toBeCalledWith('ABC', '');
    });
});
