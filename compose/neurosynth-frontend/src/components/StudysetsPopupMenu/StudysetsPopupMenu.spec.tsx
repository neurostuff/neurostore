import { act, render, RenderResult, screen } from '@testing-library/react';
import StudysetsPopupMenu from './StudysetsPopupMenu';
import userEvent from '@testing-library/user-event';
import { SnackbarProvider } from 'notistack';
import { mockStudy, mockStudysets } from 'testing/mockData';
import { useCreateStudyset, useGetStudysets, useUpdateStudyset } from 'hooks';
import { useIsFetching } from 'react-query';

jest.mock('hooks');
jest.mock('react-query');
jest.mock('components/NeurosynthPopper/NeurosynthPopper');
jest.mock('components/StateHandlerComponent/StateHandlerComponent');

describe('StudysetsPopupMenu', () => {
    let renderResult: RenderResult;
    beforeEach(() => {
        renderResult = render(
            <SnackbarProvider>
                <StudysetsPopupMenu study={mockStudy()} />
            </SnackbarProvider>
        );
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const text = screen.getByText('Add/Remove from studyset');
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

        expect(useCreateStudyset().mutate as jest.Mock).toHaveBeenCalledWith(
            {
                name: 'ABC',
                description: '',
            },
            expect.anything()
        );
    });

    it('should leave create studyset mode when cancel is clicked', async () => {
        // enable edit mode
        const createStudysetButton = screen.getByText('Create new studyset');
        userEvent.click(createStudysetButton);

        const createButton = screen.getByText('Cancel');
        await act(async () => {
            userEvent.click(createButton);
        });

        expect(screen.getByText('Create new studyset')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('should add the study to the clicked studyset', async () => {
        const menuItem = screen.getByText('studyset-name-3');

        await act(async () => {
            userEvent.click(menuItem);
        });

        expect(useUpdateStudyset().mutate as jest.Mock).toHaveBeenCalledWith(
            {
                studysetId: '88oi5AKK8aJN',
                studyset: {
                    studies: [...(mockStudysets()[2].studies as string[]), mockStudy().id],
                },
            },
            expect.anything()
        );
    });

    it('should show checkmarks next to the relevant studysets', () => {
        renderResult.rerender(
            <SnackbarProvider>
                <StudysetsPopupMenu
                    study={mockStudy({
                        studysets: mockStudysets().map((x) => ({
                            name: x.name || '',
                            description: x.description || '',
                            id: x.id || '',
                        })),
                    })}
                />
            </SnackbarProvider>
        );

        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        checkboxes.forEach((checkbox) => expect(checkbox.checked).toBeTruthy());
    });

    it('should remove the study from the clicked studyset', async () => {
        renderResult.rerender(
            <SnackbarProvider>
                <StudysetsPopupMenu
                    study={mockStudy({
                        studysets: mockStudysets().map((x) => ({
                            name: x.name || '',
                            description: x.description || '',
                            id: x.id || '',
                        })),
                    })}
                />
            </SnackbarProvider>
        );

        const menuItem = screen.getByText('studyset-name-1');

        await act(async () => {
            userEvent.click(menuItem);
        });

        expect(useUpdateStudyset().mutate as jest.Mock).toHaveBeenCalledWith(
            {
                studysetId: '4eTAChpnL3Tg',
                studyset: {
                    studies: (mockStudysets()[0].studies as string[]).filter(
                        (id) => id !== mockStudy().id
                    ),
                },
            },
            expect.anything()
        );
    });

    describe('Progress Loader', () => {
        beforeEach(() => {
            (useIsFetching as jest.Mock).mockReturnValue(0);
            useCreateStudyset().isLoading = false;
            useUpdateStudyset().isLoading = false;
            useGetStudysets({}).isLoading = false;
        });

        it('should not be shown', () => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });

        it('should show when fetching', () => {
            (useIsFetching as jest.Mock).mockReturnValue(1);
            renderResult.rerender(
                <SnackbarProvider>
                    <StudysetsPopupMenu study={mockStudy()} />
                </SnackbarProvider>
            );
            expect(screen.queryByRole('progressbar')).toBeInTheDocument();
        });

        it('should show when getting studysets', () => {
            useGetStudysets({}).isLoading = true;
            renderResult.rerender(
                <SnackbarProvider>
                    <StudysetsPopupMenu study={mockStudy()} />
                </SnackbarProvider>
            );
            expect(screen.queryByRole('progressbar')).toBeInTheDocument();
        });

        it('should show when creating studyset', () => {
            useCreateStudyset().isLoading = true;
            renderResult.rerender(
                <SnackbarProvider>
                    <StudysetsPopupMenu study={mockStudy()} />
                </SnackbarProvider>
            );
            expect(screen.queryByRole('progressbar')).toBeInTheDocument();
        });

        it('should show when updating studyset', () => {
            useUpdateStudyset().isLoading = true;
            renderResult.rerender(
                <SnackbarProvider>
                    <StudysetsPopupMenu study={mockStudy()} />
                </SnackbarProvider>
            );
            expect(screen.queryByRole('progressbar')).toBeInTheDocument();
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
