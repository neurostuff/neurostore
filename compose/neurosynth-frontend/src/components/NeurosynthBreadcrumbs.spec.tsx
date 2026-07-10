import { render, screen } from '@testing-library/react';
import NeurosynthBreadcrumbs from './NeurosynthBreadcrumbs';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { setUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { vi } from 'vitest';

vi.mock('react-router-dom');
vi.mock('components/Dialogs/ConfirmationDialog');

describe('NeurosynthBreadcrumbs Component', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        user = userEvent.setup();
        vi.clearAllMocks();
    });
    it('should render', () => {
        render(<NeurosynthBreadcrumbs breadcrumbItems={[]} />);
    });

    it('should navigate when clicked', async () => {
        render(<NeurosynthBreadcrumbs breadcrumbItems={[{ link: '/page', text: 'Page', isCurrentPage: false }]} />);

        await user.click(screen.getByText('Page'));
        expect(useNavigate()).toHaveBeenCalledWith('/page');
    });

    it('should open the confirmation dialog', async () => {
        setUnloadHandler('study');
        render(<NeurosynthBreadcrumbs breadcrumbItems={[{ link: '/page', text: 'Page', isCurrentPage: false }]} />);

        await user.click(screen.getByText('Page'));

        expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
    });

    it('should not route when the dialog is cancelled', async () => {
        setUnloadHandler('annotation');
        render(<NeurosynthBreadcrumbs breadcrumbItems={[{ link: '/page', text: 'Page', isCurrentPage: false }]} />);

        await user.click(screen.getByText('Page'));
        expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
        await user.click(screen.getByTestId('deny-close-confirmation'));
        expect(useNavigate()).not.toHaveBeenCalled();
    });

    it('should route when the dialog is accepted', async () => {
        setUnloadHandler('study');
        render(<NeurosynthBreadcrumbs breadcrumbItems={[{ link: '/page', text: 'Page', isCurrentPage: false }]} />);

        await user.click(screen.getByText('Page'));
        expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
        await user.click(screen.getByTestId('accept-close-confirmation'));
        expect(useNavigate()).toHaveBeenCalledWith('/page');
    });
});
