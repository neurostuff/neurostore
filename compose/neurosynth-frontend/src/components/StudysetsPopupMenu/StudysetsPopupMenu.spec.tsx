import { act, render, screen } from '@testing-library/react';
import StudysetsPopupMenu from './StudysetsPopupMenu';
import userEvent from '@testing-library/user-event';
import { SnackbarProvider } from 'notistack';
import { mockStudy, mockStudysets } from 'testing/mockData';
import { useCreateStudyset, useUpdateStudyset } from 'hooks';

jest.mock('hooks');
jest.mock('components/NeurosynthPopper/NeurosynthPopper');
jest.mock('components/StateHandlerComponent/StateHandlerComponent');

describe('StudysetsPopupMenu', () => {
    beforeEach(() => {
        render(
            <SnackbarProvider>
                <StudysetsPopupMenu study={mockStudy()} />
            </SnackbarProvider>
        );
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const text = screen.getByText('Add to a studyset');
        expect(text).toBeInTheDocument();
    });

    it('should have the correct number of studysets', () => {
        const rows = screen.getAllByRole('menuitem');
        // add one to include the "Create studyset" option
        expect(rows.length).toEqual(mockStudysets().length + 1);
    });

    it('should switch to create studyset mode when the button is clicked', () => {
        // enable edit mode
        const createStudysetButton = screen.getByText('Create new studyset');
        userEvent.click(createStudysetButton);

        const nameField = screen.getByText('Studyset name');
        const descriptionField = screen.getByText('Studyset description');
        const createButton = screen.getByText('Create');

        expect(nameField).toBeInTheDocument();
        expect(descriptionField).toBeInTheDocument();
        expect(createButton).toBeInTheDocument();
        expect(createButton).toBeDisabled();
    });

    it('should enable the create button when the name is not null', () => {
        // enable edit mode
        const createStudysetButton = screen.getByText('Create new studyset');
        userEvent.click(createStudysetButton);

        let createButton = screen.getByText('Create');
        expect(createButton).toBeDisabled();

        const nameField = screen.getByLabelText('Studyset name');
        userEvent.type(nameField, 'ABC');

        createButton = screen.getByText('Create');
        expect(createButton).toBeEnabled();
    });

    it('should update the values in edit mode respectively', async () => {
        // enable edit mode
        const createStudysetButton = screen.getByText('Create new studyset');
        userEvent.click(createStudysetButton);

        const nameField = screen.getByLabelText('Studyset name');
        const descriptionField = screen.getByLabelText('Studyset description');

        expect(nameField).toBeInTheDocument();
        expect(descriptionField).toBeInTheDocument();

        userEvent.type(nameField, 'ABC');
        userEvent.type(descriptionField, 'DEF');

        const updatedNameField = screen.getByDisplayValue('ABC');
        const updatedDescriptionField = screen.getByDisplayValue('DEF');

        expect(updatedNameField).toBeInTheDocument();
        expect(updatedDescriptionField).toBeInTheDocument();
    });

    it('should create a studyset when create is clicked', async () => {
        // enable edit mode
        const createStudysetButton = screen.getByText('Create new studyset');
        userEvent.click(createStudysetButton);

        // enter in text for the name
        const nameField = screen.getByLabelText('Studyset name');
        userEvent.type(nameField, 'ABC');

        const createButton = screen.getByText('Create');
        await act(async () => {
            userEvent.click(createButton);
        });

        const call = (useCreateStudyset().mutate as jest.Mock).mock.calls[0][0];

        expect(call).toEqual({
            name: 'ABC',
            description: '',
        });
    });

    it('should add the study to the clicked studyset', async () => {
        const menuItem = screen.getByRole('menuitem', { name: 'studyset-name-3' });

        await act(async () => {
            userEvent.click(menuItem);
        });

        const call = (useUpdateStudyset().mutate as jest.Mock).mock.calls[0][0];

        expect(call).toEqual({
            studysetId: '88oi5AKK8aJN',
            studyset: {
                studies: ['4ZhkLTH8k2P6'],
            },
        });
    });

    it('should handle closing the popper when clickaway is triggered', () => {
        // "open" popper
        const iconButton = screen.getAllByRole('button')[0];
        userEvent.click(iconButton);

        let mockPopper = screen.getByTestId('mock-popper-open');
        expect(mockPopper).toBeInTheDocument();

        const testTriggerClickAway = screen.getByTestId('trigger-click-away');
        userEvent.click(testTriggerClickAway);

        mockPopper = screen.getByTestId('mock-popper-closed');
        expect(mockPopper).toBeInTheDocument();
    });
});
