import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateDetailsDialog from './CreateDetailsDialog';

describe('CreateDetailsDialog', () => {
    const mockOnCreateStudyset = vi.fn();
    const mockOnCloseDialog = vi.fn();

    afterAll(() => {
        vi.clearAllMocks();
    });

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
        const nameField = screen.getByLabelText('name *'); // added to indicate it is required
        const descriptionField = screen.getByLabelText('description');
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
        const createButton = screen.getByRole('button', { name: 'create' });
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

        const nameField = screen.getByLabelText('name *');
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

        const descriptionField = screen.getByLabelText('description');
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

        const nameField = screen.getByLabelText('name *');
        userEvent.type(nameField, 'ABC');

        const createButton = screen.getByRole('button', { name: 'create' });
        userEvent.click(createButton);

        expect(mockOnCreateStudyset).toBeCalledWith('ABC', '');
    });

    it('should close when clicked away', () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        // we need to trigger a click away by clicking the backdrop. For some reason,
        // the second presentation div accomplishes this
        userEvent.click(screen.getAllByRole('presentation')[1]);
        expect(mockOnCloseDialog).toBeCalledWith();
    });

    it('should close when the close icon button is clicked', () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );
        userEvent.click(screen.getByTestId('CloseIcon'));
        expect(mockOnCloseDialog).toHaveBeenCalled();
    });
});
