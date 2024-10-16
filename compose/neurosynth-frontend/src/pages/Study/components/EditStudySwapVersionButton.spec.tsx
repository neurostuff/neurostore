import { render } from '@testing-library/react';
import EditStudySwapVersionButton from 'pages/Study/components/EditStudySwapVersionButton';

jest.mock('react-router-dom');
jest.mock('hooks');
jest.mock('pages/Project/store/ProjectStore');
jest.mock('pages/Study/store/StudyStore');
jest.mock('components/Dialogs/ConfirmationDialog');
jest.mock('notistack');

describe('EditStudySwapVersionButton Component', () => {
    it('should render', () => {
        render(<EditStudySwapVersionButton />);
    });

    it('should open the menu when clicked', () => {});

    it('should show the base study versions', () => {});

    it('should switch the study version', () => {});

    it('should show the dialog is there are unsaved changes', () => {});
});
