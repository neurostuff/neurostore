import { vi } from 'vitest';
import { useAuth0 } from '@auth0/auth0-react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextEdit from './TextEdit';

vi.mock('@auth0/auth0-react');

describe('TextEdit', () => {
    const mockOnSave = vi.fn();

    beforeEach(() => {
        useAuth0().isAuthenticated = true;
    });

    afterAll(() => {
        vi.clearAllMocks();
    });

    it('should render', () => {
        render(
            <TextEdit onSave={mockOnSave} textToEdit="test-text">
                <span>test-text</span>
            </TextEdit>
        );
        const text = screen.getByText('test-text');
        expect(text).toBeInTheDocument();
    });

    it('should change to edit mode when icon is clicked', () => {
        render(
            <TextEdit onSave={mockOnSave} textToEdit="test-text">
                <span>test-text</span>
            </TextEdit>
        );

        const editIconButton = screen.getByRole('button');
        userEvent.click(editIconButton);

        const textField = screen.getByRole('textbox');
        expect(textField).toBeInTheDocument();

        const saveButton = screen.getByText('Save');
        const cancelButton = screen.getByText('Cancel');

        expect(saveButton).toBeInTheDocument();
        expect(cancelButton).toBeInTheDocument();
    });

    it('should go back to display mode when cancel is clicked', () => {
        render(
            <TextEdit onSave={mockOnSave} textToEdit="test-text">
                <span>test-text</span>
            </TextEdit>
        );

        // set to edit mode
        const editIconButton = screen.getByRole('button');
        userEvent.click(editIconButton);

        // set back to display mode
        const cancelButton = screen.getByText('Cancel');
        userEvent.click(cancelButton);

        const textField = screen.queryByRole('textbox');
        expect(textField).not.toBeInTheDocument();
    });

    it('should update the value when modified', () => {
        render(
            <TextEdit onSave={mockOnSave} textToEdit="test-text">
                <span>test-text</span>
            </TextEdit>
        );

        // set to edit mode
        const editIconButton = screen.getByRole('button');
        userEvent.click(editIconButton);

        // type the letter A
        const textField = screen.getByRole('textbox');
        userEvent.type(textField, 'A');

        const newVal = screen.getByDisplayValue('test-textA');
        expect(newVal).toBeInTheDocument();
    });

    it('should not show the edit button when not authenticated', () => {
        useAuth0().isAuthenticated = false;

        render(
            <TextEdit onSave={mockOnSave} textToEdit="test-text">
                <span>test-text</span>
            </TextEdit>
        );

        const button = screen.queryByRole('button');
        expect(button).toBeFalsy();
    });

    it('should not show the edit button if editIconIsVisible flag is set to false', () => {
        useAuth0().isAuthenticated = true;

        render(
            <TextEdit onSave={mockOnSave} editIconIsVisible={false} textToEdit="test-text">
                <span>test-text</span>
            </TextEdit>
        );

        const button = screen.queryByRole('button');
        expect(button).toBeFalsy();
    });

    it('should show the edit button when authenticated', () => {
        render(
            <TextEdit onSave={mockOnSave} textToEdit="test-text">
                <span>test-text</span>
            </TextEdit>
        );

        const button = screen.queryByRole('button');
        expect(button).toBeInTheDocument();
    });

    it('should call onSave when the save button is clicked', async () => {
        render(
            <TextEdit onSave={mockOnSave} label="some-label" textToEdit="test-text">
                <span>test-text</span>
            </TextEdit>
        );

        // set to edit mode
        const editIconButton = screen.getByRole('button');
        userEvent.click(editIconButton);

        // type the letter A
        const textField = screen.getByRole('textbox');
        userEvent.type(textField, 'A');

        const saveButton = screen.getByText('Save');
        userEvent.click(saveButton);

        expect(mockOnSave).toBeCalledWith('test-textA', 'some-label');
    });

    it('should not show the loading icon', () => {
        render(
            <TextEdit
                isLoading={false}
                onSave={mockOnSave}
                label="some-label"
                textToEdit="test-text"
            >
                <span>test-text</span>
            </TextEdit>
        );

        const progressLoader = screen.queryByRole('progressbar');
        expect(progressLoader).not.toBeInTheDocument();
    });

    it('should show the loading icon', () => {
        render(
            <TextEdit
                isLoading={true}
                onSave={mockOnSave}
                label="some-label"
                textToEdit="test-text"
            >
                <span>test-text</span>
            </TextEdit>
        );

        const progressLoader = screen.getByRole('progressbar');
        expect(progressLoader).toBeInTheDocument();
    });
});
