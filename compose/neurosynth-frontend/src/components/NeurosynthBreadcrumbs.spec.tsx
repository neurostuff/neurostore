import { render, screen } from '@testing-library/react';
import NeurosynthBreadcrumbs from './NeurosynthBreadcrumbs';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { setUnloadHandler } from 'helpers/BeforeUnload.helpers';

jest.mock('react-router-dom');
jest.mock('components/Dialogs/ConfirmationDialog');

describe('NeurosynthBreadcrumbs Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should render', () => {
        render(<NeurosynthBreadcrumbs breadcrumbItems={[]} />);
    });

    it('should navigate when clicked', () => {
        render(
            <NeurosynthBreadcrumbs
                breadcrumbItems={[{ link: '/page', text: 'Page', isCurrentPage: false }]}
            />
        );

        userEvent.click(screen.getByText('Page'));
        expect(useNavigate()).toHaveBeenCalledWith('/page');
    });

    it('should open the confirmation dialog', () => {
        setUnloadHandler('study');
        render(
            <NeurosynthBreadcrumbs
                breadcrumbItems={[{ link: '/page', text: 'Page', isCurrentPage: false }]}
            />
        );

        userEvent.click(screen.getByText('Page'));

        expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
    });

    it('should not route when the dialog is cancelled', () => {
        setUnloadHandler('annotation');
        render(
            <NeurosynthBreadcrumbs
                breadcrumbItems={[{ link: '/page', text: 'Page', isCurrentPage: false }]}
            />
        );

        userEvent.click(screen.getByText('Page'));
        expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
        userEvent.click(screen.getByTestId('deny-close-confirmation'));
        expect(useNavigate()).not.toHaveBeenCalled();
    });

    it('should route when the dialog is accepted', () => {
        setUnloadHandler('study');
        render(
            <NeurosynthBreadcrumbs
                breadcrumbItems={[{ link: '/page', text: 'Page', isCurrentPage: false }]}
            />
        );

        userEvent.click(screen.getByText('Page'));
        expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
        userEvent.click(screen.getByTestId('accept-close-confirmation'));
        expect(useNavigate()).toHaveBeenCalledWith('/page');
    });
});
