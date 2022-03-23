import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateDetailsDialog from './CreateDetailsDialog';

describe('CreateDetailsDialog', () => {
    const mockOnCreateStudyset = jest.fn();
    const mockOnCloseDialog = jest.fn();
    it('should render', () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );
        const text = screen.getByText('some title text');
        const nameField = screen.getByLabelText('Name *'); // added to indicate it is required
        const descriptionField = screen.getByLabelText('Description');
        expect(text).toBeInTheDocument();
        expect(nameField).toBeInTheDocument();
        expect(descriptionField).toBeInTheDocument();
    });

    it('should close when cancel is clicked', () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const closeButton = screen.getByRole('button', { name: 'Cancel' });
        userEvent.click(closeButton);

        expect(mockOnCloseDialog).toBeCalled();
    });

    it('should be disabled', () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );
        const createButton = screen.getByRole('button', { name: 'Create' });
        expect(createButton).toBeDisabled();
    });

    it('should update the name textfield when text is entered', () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const nameField = screen.getByLabelText('Name *');
        userEvent.type(nameField, 'ABC');

        const displayNameFieldText = screen.getByDisplayValue('ABC');
        expect(displayNameFieldText).toBeInTheDocument();
    });

    it('should update the description textfield when text is entered', () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const descriptionField = screen.getByLabelText('Description');
        userEvent.type(descriptionField, 'ABC');

        const displayDescriptionFieldText = screen.getByDisplayValue('ABC');
        expect(displayDescriptionFieldText).toBeInTheDocument();
    });

    it('should call the create func with the correct data when create is clicked', () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const nameField = screen.getByLabelText('Name *');
        userEvent.type(nameField, 'ABC');

        const createButton = screen.getByRole('button', { name: 'Create' });
        userEvent.click(createButton);

        expect(mockOnCreateStudyset).toBeCalledWith('ABC', '');
    });
});
