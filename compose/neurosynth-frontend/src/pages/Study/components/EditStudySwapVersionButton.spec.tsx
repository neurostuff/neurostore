import { vi, Mock } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUpdateStudyset } from 'hooks';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { useProjectExtractionReplaceStudyListStatusId } from 'pages/Project/store/ProjectStore';
import EditStudySwapVersionButton from 'pages/Study/components/EditStudySwapVersionButton';
import { useNavigate } from 'react-router-dom';
import { mockBaseStudy, mockStudysetNotNested } from 'testing/mockData';
import { useStudyId } from 'pages/Study/store/StudyStore';
import { setUnloadHandler, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';

vi.mock('react-router-dom');
vi.mock('hooks');
vi.mock('pages/Project/store/ProjectStore');
vi.mock('pages/Study/store/StudyStore');
vi.mock('components/Dialogs/ConfirmationDialog');
vi.mock('notistack');
vi.mock('helpers/Annotation.helpers');
vi.mock('stores/AnnotationStore.getters');

describe('EditStudySwapVersionButton Component', () => {
    it('should render', () => {
        render(<EditStudySwapVersionButton />);
    });

    it('should open the menu when clicked', () => {
        render(<EditStudySwapVersionButton />);
        const button = screen.getByRole('button');
        userEvent.click(button);

        expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should show the base study versions', () => {
        render(<EditStudySwapVersionButton />);
        const baseStudy = mockBaseStudy();
        const button = screen.getByRole('button');
        userEvent.click(button);

        baseStudy.versions?.forEach((version) => {
            expect(screen.getByText(`Switch to version: ${(version as StudyReturn).id as string}`)).toBeInTheDocument();
        });
    });

    it('should link to the selected base study version when viewing', () => {
        render(<EditStudySwapVersionButton />);
        const baseStudy = mockBaseStudy();
        const button = screen.getByRole('button');
        userEvent.click(button);

        const viewLinks = screen.getAllByRole('link', { name: /View version/i });
        const versionId = (baseStudy.versions as StudyReturn[])[0].id as string;
        expect(viewLinks[0]).toHaveAttribute('href', `/base-studies/base-study-id/${versionId}`);
    });

    it('should switch the study version', async () => {
        const studyset = mockStudysetNotNested();
        (useStudyId as Mock).mockReturnValue(studyset.studies?.[0]);
        const baseStudy = mockBaseStudy();
        render(<EditStudySwapVersionButton />);
        const button = screen.getByRole('button');
        await act(async () => {
            userEvent.click(button);
        });
        const swapButton = screen.getByText(`Switch to version: ${(baseStudy.versions as StudyReturn[])[0].id}`);
        await act(async () => {
            userEvent.click(swapButton);
        });
        expect(screen.getByText('Are you sure you want to switch the study version?'));

        const confirmButton = screen.getByTestId('accept-close-confirmation');
        await act(async () => {
            userEvent.click(confirmButton);
        });

        expect(useUpdateStudyset().mutateAsync).toHaveBeenCalled();
        expect(useProjectExtractionReplaceStudyListStatusId()).toHaveBeenCalled();
        expect(useNavigate()).toHaveBeenCalledWith(
            `/projects/project-id/extraction/studies/${(baseStudy.versions as StudyReturn[])[0].id}/edit`
        );
    });

    it('should show the dialog if there are unsaved changes', async () => {
        const baseStudy = mockBaseStudy();
        setUnloadHandler('study');
        render(<EditStudySwapVersionButton />);
        const button = screen.getByRole('button');
        await act(async () => {
            userEvent.click(button);
        });
        const swapButton = screen.getByText(`Switch to version: ${(baseStudy.versions as StudyReturn[])[0].id}`);
        await act(async () => {
            userEvent.click(swapButton);
        });

        const confirmButton = screen.getByTestId('accept-close-confirmation');
        await act(async () => {
            userEvent.click(confirmButton);
        });

        expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    });
});
