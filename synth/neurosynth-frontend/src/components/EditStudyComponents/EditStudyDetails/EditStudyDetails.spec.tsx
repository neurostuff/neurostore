import { act, render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditStudyDetails, { IEditStudyDetails } from './EditStudyDetails';
import { useAuth0 } from '@auth0/auth0-react';
import API from '../../../utils/api';

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

describe('EditStudyDetails Component', () => {
    let mockStudyDetails: IEditStudyDetails;
    let renderResult: RenderResult;

    beforeEach(() => {
        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: () => {},
        });

        mockStudyDetails = {
            studyId: 'some-test-id',
            name: 'some-test-name',
            description: 'some-test-description',
            authors: 'some-test-authors',
            doi: 'some-test-doi',
            publication: 'some-test-publication',
            onEditStudyDetails: jest.fn(),
        };

        renderResult = render(<EditStudyDetails {...mockStudyDetails} />);
    });

    it('should render', () => {
        const title = screen.getByText('Edit Study Details');
        expect(title).toBeInTheDocument();
    });

    it('should call the onEditStudyDetails func with the correct arguments when editing the name textbox', () => {
        // open accordion
        const title = screen.getByText('Edit Study Details');
        userEvent.click(title);

        const nameTextbox = screen.getByDisplayValue(mockStudyDetails.name);
        userEvent.type(nameTextbox, 'A');

        expect(mockStudyDetails.onEditStudyDetails).toHaveBeenCalledWith({
            name: mockStudyDetails.name + 'A',
        });
    });

    it('should call the onEditStudyDetails func with the correct arguments when editing the authors textbox', () => {
        // open accordion
        const title = screen.getByText('Edit Study Details');
        userEvent.click(title);

        const authorsTextbox = screen.getByDisplayValue(mockStudyDetails.authors);
        userEvent.type(authorsTextbox, 'B');

        expect(mockStudyDetails.onEditStudyDetails).toHaveBeenCalledWith({
            authors: mockStudyDetails.authors + 'B',
        });
    });

    it('should call the onEditStudyDetails func with the correct arguments when editing the journal (publication) textbox', () => {
        // open accordion
        const title = screen.getByText('Edit Study Details');
        userEvent.click(title);

        const publicationTextbox = screen.getByDisplayValue(mockStudyDetails.publication);
        userEvent.type(publicationTextbox, 'C');

        expect(mockStudyDetails.onEditStudyDetails).toHaveBeenCalledWith({
            publication: mockStudyDetails.publication + 'C',
        });
    });

    it('should call the onEditStudyDetails func with the correct arguments when editing the DOI textbox', () => {
        // open accordion
        const title = screen.getByText('Edit Study Details');
        userEvent.click(title);

        const doiTextbox = screen.getByDisplayValue(mockStudyDetails.doi);
        userEvent.type(doiTextbox, 'D');

        expect(mockStudyDetails.onEditStudyDetails).toHaveBeenCalledWith({
            doi: mockStudyDetails.doi + 'D',
        });
    });

    it('should call the onEditStudyDetails func with the correct arguments when editing the description textbox', () => {
        // open accordion
        const title = screen.getByText('Edit Study Details');
        userEvent.click(title);

        const descriptionTextbox = screen.getByDisplayValue(mockStudyDetails.description);
        userEvent.type(descriptionTextbox, 'E');

        expect(mockStudyDetails.onEditStudyDetails).toHaveBeenCalledWith({
            description: mockStudyDetails.description + 'E',
        });
    });

    it('should indicate changes need to be saved when the textboxes are modified', () => {
        // open accordion
        const title = screen.getByText('Edit Study Details');
        userEvent.click(title);

        const descriptionTextbox = screen.getByDisplayValue(mockStudyDetails.description);
        userEvent.type(descriptionTextbox, 'E');

        const saveChangesText = screen.getByText('unsaved changes');
        expect(saveChangesText).toBeInTheDocument();
    });

    it('should call the API when the update button is clicked', async () => {
        // open accordion
        const title = screen.getByText('Edit Study Details');
        userEvent.click(title);

        const descriptionTextbox = screen.getByDisplayValue(mockStudyDetails.description);
        userEvent.type(descriptionTextbox, 'E');

        // pretend we are the parent handler function and manually set the new value and trigger a rerender
        mockStudyDetails.description = mockStudyDetails.description + 'E';
        renderResult.rerender(<EditStudyDetails {...mockStudyDetails} />);

        let saveChangesText: HTMLElement | null = screen.getByText('unsaved changes');
        expect(saveChangesText).toBeInTheDocument();

        const updateButton = screen.getByRole('button', { name: 'Update' });

        await act(async () => {
            userEvent.click(updateButton);
        });

        expect(API.Services.StudiesService.studiesIdPut).toHaveBeenCalledWith('some-test-id', {
            name: mockStudyDetails.name,
            description: mockStudyDetails.description,
            authors: mockStudyDetails.authors,
            publication: mockStudyDetails.publication,
            doi: mockStudyDetails.doi,
        });

        saveChangesText = screen.queryByText('unsaved changes');
        expect(saveChangesText).not.toBeInTheDocument();
    });

    it('should not indicate save changes after we call the API and update', async () => {
        // open accordion
        const title = screen.getByText('Edit Study Details');
        userEvent.click(title);

        const descriptionTextbox = screen.getByDisplayValue(mockStudyDetails.description);
        userEvent.type(descriptionTextbox, 'E');

        // pretend we are the parent handler function and manually set the new value and trigger a rerender
        mockStudyDetails.description = mockStudyDetails.description + 'E';
        renderResult.rerender(<EditStudyDetails {...mockStudyDetails} />);

        let saveChangesText: HTMLElement | null = screen.getByText('unsaved changes');
        expect(saveChangesText).toBeInTheDocument();

        const updateButton = screen.getByRole('button', { name: 'Update' });

        await act(async () => {
            userEvent.click(updateButton);
        });

        saveChangesText = screen.queryByText('unsaved changes');
        expect(saveChangesText).not.toBeInTheDocument();
    });

    it('should call the onEditStudyDetails func with the original data when the cancel button is clicked', () => {
        // open accordion
        const title = screen.getByText('Edit Study Details');
        userEvent.click(title);

        // we expect the cancel button to be disabled initially
        let revertChangesButton = screen.getByRole('button', { name: 'Cancel' });
        expect(revertChangesButton).toBeDisabled();

        // mock a type event in order to enable the cancel button
        let descriptionTextbox = screen.getByDisplayValue(mockStudyDetails.description);
        userEvent.type(descriptionTextbox, 'E');

        // pretend we are the parent handler function and manually set the new value and trigger a rerender.
        mockStudyDetails.description = mockStudyDetails.description + 'E';
        renderResult.rerender(<EditStudyDetails {...mockStudyDetails} />);

        // expect the updated value to be reflected in the textbox
        descriptionTextbox = screen.getByDisplayValue(mockStudyDetails.description);
        expect(descriptionTextbox).toBeInTheDocument();

        // cancel button should now be enabled
        revertChangesButton = screen.getByRole('button', { name: 'Cancel' });
        expect(revertChangesButton).not.toBeDisabled();

        userEvent.click(revertChangesButton);

        expect(mockStudyDetails.onEditStudyDetails).toHaveBeenLastCalledWith({
            studyId: mockStudyDetails.studyId,
            name: mockStudyDetails.name,
            doi: mockStudyDetails.doi,
            description: mockStudyDetails.description.slice(
                0,
                mockStudyDetails.description.length - 1
            ),
            authors: mockStudyDetails.authors,
            publication: mockStudyDetails.publication,
        });
    });

    it('should not indicate unsaved changes when the Cancel button is clicked', () => {
        // open accordion
        const title = screen.getByText('Edit Study Details');
        userEvent.click(title);

        // we expect the cancel button to be disabled initially
        let revertChangesButton = screen.getByRole('button', { name: 'Cancel' });
        expect(revertChangesButton).toBeDisabled();

        // mock a type event in order to enable the cancel button
        let descriptionTextbox = screen.getByDisplayValue(mockStudyDetails.description);
        userEvent.type(descriptionTextbox, 'E');

        // Cancel button should now be enabled
        revertChangesButton = screen.getByRole('button', { name: 'Cancel' });
        expect(revertChangesButton).not.toBeDisabled();

        userEvent.click(revertChangesButton);

        const unsavedChangesText = screen.queryByText('unsaved changes');
        expect(unsavedChangesText).not.toBeInTheDocument();

        revertChangesButton = screen.getByRole('button', { name: 'Cancel' });
        expect(revertChangesButton).toBeDisabled();

        const updateButton = screen.getByRole('button', { name: 'Update' });
        expect(updateButton).toBeDisabled();
    });
});
