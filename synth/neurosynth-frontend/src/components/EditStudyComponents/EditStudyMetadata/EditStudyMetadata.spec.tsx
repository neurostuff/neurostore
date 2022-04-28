import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import API from '../../../utils/api';
import EditStudyMetadata from './EditStudyMetadata';

jest.mock('@auth0/auth0-react');
jest.mock('../../../utils/api');

describe('EditStudyMetadata Component', () => {
    const handleUpdateStudyMetadata = jest.fn();

    const mockMetadata: { [key: string]: any } = {
        firstTestKey: 'some value',
        secondTestKey: 12345,
        thirdTestKey: false,
        fourthTestKey: null,
    };

    beforeEach(() => {
        (API.NeurostoreServices.StudiesService.studiesIdPut as jest.Mock).mockReturnValue(
            Promise.resolve({})
        );

        render(
            <EditStudyMetadata
                studyId={'some-test-id'}
                metadata={mockMetadata}
                onUpdateStudyMetadata={handleUpdateStudyMetadata}
            />
        );

        // open accordion
        const title = screen.getByText('Edit Study Metadata');
        userEvent.click(title);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const title = screen.getByText('Edit Study Metadata');
        expect(title).toBeInTheDocument();
    });

    it('should have disabled buttons', () => {
        const saveButton = screen.getByText('Save');
        expect(saveButton).toBeDisabled();

        const revertChanges = screen.getByText('Cancel');
        expect(revertChanges).toBeDisabled();
    });

    it('should add a new row successfully and call the API with the correct arguments', async () => {
        const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
        userEvent.type(addMetadataKeyTextbox, 'X');

        const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
        userEvent.click(addMetadataRowButton);

        const numRows = screen.getAllByRole('button', { name: 'DELETE' });
        expect(numRows.length).toBe(5);

        const saveButton = screen.getByRole('button', { name: 'Save' });

        // wrap event in act to prevent react error about updating state
        await act(async () => {
            userEvent.click(saveButton);
        });

        expect(API.NeurostoreServices.StudiesService.studiesIdPut).toHaveBeenCalledWith(
            'some-test-id',
            {
                metadata: {
                    X: '',
                    firstTestKey: 'some value',
                    secondTestKey: 12345,
                    thirdTestKey: false,
                    fourthTestKey: null,
                },
            }
        );
    });

    it('should not add a new row with an existing key', () => {
        const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
        userEvent.type(addMetadataKeyTextbox, 'firstTestKey');

        const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
        userEvent.click(addMetadataRowButton);

        const errMsg = screen.getByText('All metadata keys must be unique');
        expect(errMsg).toBeInTheDocument();
    });

    it('should save successfully and call the API with the correct arguments', async () => {
        const firstRowElement = screen.getByText('some value');
        userEvent.type(firstRowElement, ' and more text');

        const update = screen.getByText('some value and more text');
        expect(update).toBeInTheDocument();

        const saveButton = screen.getByRole('button', { name: 'Save' });

        // wrap event in act to prevent react error about updating state
        await act(async () => {
            userEvent.click(saveButton);
        });

        expect(API.NeurostoreServices.StudiesService.studiesIdPut).toHaveBeenCalledWith(
            'some-test-id',
            {
                metadata: {
                    firstTestKey: 'some value and more text',
                    secondTestKey: 12345,
                    thirdTestKey: false,
                    fourthTestKey: null,
                },
            }
        );
    });

    it('should delete successfully and call the API with the correct arguments', async () => {
        const firstDeleteButton = screen.getAllByRole('button', { name: 'DELETE' })[0];
        userEvent.click(firstDeleteButton);

        const valueNotPresent = screen.queryByText('some value');
        expect(valueNotPresent).not.toBeInTheDocument();

        const saveButton = screen.getByRole('button', { name: 'Save' });

        // wrap event in act to prevent react error about updating state
        await act(async () => {
            userEvent.click(saveButton);
        });

        expect(API.NeurostoreServices.StudiesService.studiesIdPut).toHaveBeenCalledWith(
            'some-test-id',
            {
                metadata: {
                    secondTestKey: 12345,
                    thirdTestKey: false,
                    fourthTestKey: null,
                },
            }
        );
    });

    it('should call the handleUpdateStudyMetadata on successful API calls', async () => {
        const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
        userEvent.type(addMetadataKeyTextbox, 'X');

        const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
        userEvent.click(addMetadataRowButton);

        const saveButton = screen.getByRole('button', { name: 'Save' });

        // wrap event in act to prevent react error about updating state
        await act(async () => {
            userEvent.click(saveButton);
        });

        expect(handleUpdateStudyMetadata).toHaveBeenCalledWith({
            X: '',
            firstTestKey: 'some value',
            secondTestKey: 12345,
            thirdTestKey: false,
            fourthTestKey: null,
        });
    });

    it('should revert changes when the Cancel button is clicked', () => {
        const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
        userEvent.type(addMetadataKeyTextbox, 'X');

        const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
        userEvent.click(addMetadataRowButton);

        let addedKVP = screen.queryByText('X');
        expect(addedKVP).toBeInTheDocument();

        const revertChangesButton = screen.getByRole('button', { name: 'Cancel' });
        userEvent.click(revertChangesButton);

        const saveButton = screen.getByRole('button', { name: 'Save' });

        expect(saveButton).toBeDisabled();
        expect(revertChangesButton).toBeDisabled();

        addedKVP = screen.queryByText('X');
        expect(addedKVP).not.toBeInTheDocument();
    });

    describe('edit study metadata unsaved changes', () => {
        it('should show when a new item is added', () => {
            const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
            userEvent.type(addMetadataKeyTextbox, 'X');

            const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
            userEvent.click(addMetadataRowButton);

            const unsavedChangesText = screen.getByText('unsaved changes');
            expect(unsavedChangesText).toBeInTheDocument();
        });

        it('should show when an item has been deleted', () => {
            const firstDeleteButton = screen.getAllByRole('button', { name: 'DELETE' })[0];
            userEvent.click(firstDeleteButton);

            const unsavedChangesText = screen.getByText('unsaved changes');
            expect(unsavedChangesText).toBeInTheDocument();
        });

        it('should show when an item has been modified', () => {
            const firstRowElement = screen.getByText('some value');
            userEvent.type(firstRowElement, ' and more text');

            const unsavedChangesText = screen.getByText('unsaved changes');
            expect(unsavedChangesText).toBeInTheDocument();
        });

        it('should be removed on save', async () => {
            const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
            userEvent.type(addMetadataKeyTextbox, 'X');

            const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
            userEvent.click(addMetadataRowButton);

            let unsavedChangesText: HTMLElement | null = screen.getByText('unsaved changes');
            expect(unsavedChangesText).toBeInTheDocument();

            const saveButton = screen.getByRole('button', { name: 'Save' });
            // wrap event in act to prevent react error about updating state
            await act(async () => {
                userEvent.click(saveButton);
            });

            unsavedChangesText = screen.queryByText('unsaved changes');
            expect(unsavedChangesText).not.toBeInTheDocument();
        });
    });
});
