import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import API from '../../../utils/api';
import EditStudyMetadata from './EditStudyMetadata';

jest.mock('@auth0/auth0-react');
jest.mock('../../../utils/api', () => {
    return {
        __esModule: true,
        default: {
            Services: {
                StudiesService: {
                    studiesIdPut: jest.fn(() => {
                        return Promise.resolve();
                    }),
                },
            },
        },
    };
});

describe('EditStudyMetadata Component', () => {
    const handleUpdateStudyMetadata = jest.fn();

    const mockMetadata: { [key: string]: any } = {
        firstTestKey: 'some value',
        secondTestKey: 12345,
        thirdTestKey: false,
        fourthTestKey: null,
    };

    beforeEach(() => {
        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: () => {},
        });

        render(
            <EditStudyMetadata
                studyId={'some-test-id'}
                metadata={mockMetadata}
                onUpdateStudyMetadata={handleUpdateStudyMetadata}
            />
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const title = screen.getByText('Edit Study Metadata');
        expect(title).toBeInTheDocument();
    });

    it('should have disabled buttons', () => {
        // open accordion
        const title = screen.getByText('Edit Study Metadata');
        userEvent.click(title);
        const updateButton = screen.getByText('Update');
        expect(updateButton).toBeDisabled();

        const revertChanges = screen.getByText('Revert Changes');
        expect(revertChanges).toBeDisabled();
    });

    it('should add a new row successfully and call the API with the correct arguments', async () => {
        // open accordion
        const title = screen.getByText('Edit Study Metadata');
        userEvent.click(title);

        const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
        userEvent.type(addMetadataKeyTextbox, 'X');

        const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
        userEvent.click(addMetadataRowButton);

        const numRows = screen.getAllByRole('button', { name: 'DELETE' });
        expect(numRows.length).toBe(5);

        const updateButton = screen.getByRole('button', { name: 'Update' });

        // wrap event in act to prevent react error about updating state
        await act(async () => {
            userEvent.click(updateButton);
        });

        expect(API.Services.StudiesService.studiesIdPut).toHaveBeenCalledWith('some-test-id', {
            metadata: {
                X: '',
                firstTestKey: 'some value',
                secondTestKey: 12345,
                thirdTestKey: false,
                fourthTestKey: null,
            },
        });
    });

    it('should not add a new row with an existing key', () => {
        // open accordion
        const title = screen.getByText('Edit Study Metadata');
        userEvent.click(title);

        const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
        userEvent.type(addMetadataKeyTextbox, 'firstTestKey');

        const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
        userEvent.click(addMetadataRowButton);

        const errMsg = screen.getByText('All metadata keys must be unique');
        expect(errMsg).toBeInTheDocument();
    });

    it('should update successfully and call the API with the correct arguments', async () => {
        // open accordion
        const title = screen.getByText('Edit Study Metadata');
        userEvent.click(title);

        const firstRowElement = screen.getByText('some value');
        userEvent.type(firstRowElement, ' and more text');

        const update = screen.getByText('some value and more text');
        expect(update).toBeInTheDocument();

        const updateButton = screen.getByRole('button', { name: 'Update' });

        // wrap event in act to prevent react error about updating state
        await act(async () => {
            userEvent.click(updateButton);
        });

        expect(API.Services.StudiesService.studiesIdPut).toHaveBeenCalledWith('some-test-id', {
            metadata: {
                firstTestKey: 'some value and more text',
                secondTestKey: 12345,
                thirdTestKey: false,
                fourthTestKey: null,
            },
        });
    });

    it('should delete successfully and call the API with the correct arguments', async () => {
        // open accordion
        const title = screen.getByText('Edit Study Metadata');
        userEvent.click(title);

        const firstDeleteButton = screen.getAllByRole('button', { name: 'DELETE' })[0];
        userEvent.click(firstDeleteButton);

        const valueNotPresent = screen.queryByText('some value');
        expect(valueNotPresent).not.toBeInTheDocument();

        const updateButton = screen.getByRole('button', { name: 'Update' });

        // wrap event in act to prevent react error about updating state
        await act(async () => {
            userEvent.click(updateButton);
        });

        expect(API.Services.StudiesService.studiesIdPut).toHaveBeenCalledWith('some-test-id', {
            metadata: {
                secondTestKey: 12345,
                thirdTestKey: false,
                fourthTestKey: null,
            },
        });
    });

    it('should call the handleUpdateStudyMetadata on successful API calls', async () => {
        // open accordion
        const title = screen.getByText('Edit Study Metadata');
        userEvent.click(title);

        const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
        userEvent.type(addMetadataKeyTextbox, 'X');

        const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
        userEvent.click(addMetadataRowButton);

        const updateButton = screen.getByRole('button', { name: 'Update' });

        // wrap event in act to prevent react error about updating state
        await act(async () => {
            userEvent.click(updateButton);
        });

        expect(handleUpdateStudyMetadata).toHaveBeenCalledWith({
            X: '',
            firstTestKey: 'some value',
            secondTestKey: 12345,
            thirdTestKey: false,
            fourthTestKey: null,
        });
    });

    it('should revert changes when the revert changes button is clicked', () => {
        // open accordion
        const title = screen.getByText('Edit Study Metadata');
        userEvent.click(title);

        const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
        userEvent.type(addMetadataKeyTextbox, 'X');

        const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
        userEvent.click(addMetadataRowButton);

        let addedKVP = screen.queryByText('X');
        expect(addedKVP).toBeInTheDocument();

        const revertChangesButton = screen.getByRole('button', { name: 'Revert Changes' });
        userEvent.click(revertChangesButton);

        const updateButton = screen.getByRole('button', { name: 'Update' });

        expect(updateButton).toBeDisabled();
        expect(revertChangesButton).toBeDisabled();

        addedKVP = screen.queryByText('X');
        expect(addedKVP).not.toBeInTheDocument();
    });

    describe('edit study metadata unsaved changes', () => {
        it('should show when a new item is added', () => {
            // open accordion
            const title = screen.getByText('Edit Study Metadata');
            userEvent.click(title);

            const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
            userEvent.type(addMetadataKeyTextbox, 'X');

            const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
            userEvent.click(addMetadataRowButton);

            const unsavedChangesText = screen.getByText('unsaved changes');
            expect(unsavedChangesText).toBeInTheDocument();
        });

        it('should show when an item has been deleted', () => {
            // open accordion
            const title = screen.getByText('Edit Study Metadata');
            userEvent.click(title);

            const firstDeleteButton = screen.getAllByRole('button', { name: 'DELETE' })[0];
            userEvent.click(firstDeleteButton);

            const unsavedChangesText = screen.getByText('unsaved changes');
            expect(unsavedChangesText).toBeInTheDocument();
        });

        it('should show when an item has been modified', () => {
            // open accordion
            const title = screen.getByText('Edit Study Metadata');
            userEvent.click(title);

            const firstRowElement = screen.getByText('some value');
            userEvent.type(firstRowElement, ' and more text');

            const unsavedChangesText = screen.getByText('unsaved changes');
            expect(unsavedChangesText).toBeInTheDocument();
        });

        it('should be removed on update', async () => {
            // open accordion
            const title = screen.getByText('Edit Study Metadata');
            userEvent.click(title);

            const addMetadataKeyTextbox = screen.getByPlaceholderText('New metadata key');
            userEvent.type(addMetadataKeyTextbox, 'X');

            const addMetadataRowButton = screen.getByRole('button', { name: 'ADD' });
            userEvent.click(addMetadataRowButton);

            let unsavedChangesText: HTMLElement | null = screen.getByText('unsaved changes');
            expect(unsavedChangesText).toBeInTheDocument();

            const updateButton = screen.getByRole('button', { name: 'Update' });
            // wrap event in act to prevent react error about updating state
            await act(async () => {
                userEvent.click(updateButton);
            });

            unsavedChangesText = screen.queryByText('unsaved changes');
            expect(unsavedChangesText).not.toBeInTheDocument();
        });
    });
});