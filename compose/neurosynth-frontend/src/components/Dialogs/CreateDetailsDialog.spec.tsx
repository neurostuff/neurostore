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

    it('should render', async () => {
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

    it('should close when cancel is clicked', async () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const closeButton = screen.getByRole('button', { name: 'Cancel' });
        await userEvent.click(closeButton);

        expect(mockOnCloseDialog).toBeCalled();
    });

    it('should be disabled', async () => {
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

    it('should update the name textfield when text is entered', async () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const nameField = screen.getByLabelText('name *');
        await userEvent.type(nameField, 'ABC');

        const displayNameFieldText = screen.getByDisplayValue('ABC');
        expect(displayNameFieldText).toBeInTheDocument();
    });

    it('should update the description textfield when text is entered', async () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const descriptionField = screen.getByLabelText('description');
        await userEvent.type(descriptionField, 'ABC');

        const displayDescriptionFieldText = screen.getByDisplayValue('ABC');
        expect(displayDescriptionFieldText).toBeInTheDocument();
    });

    it('should call the create func with the correct data when create is clicked', async () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );

        const nameField = screen.getByLabelText('name *');
        await userEvent.type(nameField, 'ABC');

        const createButton = screen.getByRole('button', { name: 'create' });
        await userEvent.click(createButton);

        expect(mockOnCreateStudyset).toBeCalledWith('ABC', '');
    });

    it('should close when clicked away', async () => {
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
        await userEvent.click(screen.getAllByRole('presentation')[1]);
        expect(mockOnCloseDialog).toBeCalledWith();
    });

    it('should close when the close icon button is clicked', async () => {
        render(
            <CreateDetailsDialog
                titleText="some title text"
                isOpen={true}
                onCreate={mockOnCreateStudyset}
                onCloseDialog={mockOnCloseDialog}
            />
        );
        await userEvent.click(screen.getByTestId('CloseIcon'));
        expect(mockOnCloseDialog).toHaveBeenCalled();
    });
});
