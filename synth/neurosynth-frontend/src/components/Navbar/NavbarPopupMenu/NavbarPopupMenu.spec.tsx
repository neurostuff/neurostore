import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { NavOptionsModel } from '..';
import NavbarPopupMenu from './NavbarPopupMenu';

jest.mock('@auth0/auth0-react');
jest.mock('../../NeurosynthPopper/NeurosynthPopper');

describe('NavbarPopupMenu', () => {
    const mockgetAccessTokenSilently = jest.fn();

    const mockNavOptions: NavOptionsModel = {
        label: 'test-label',
        path: '/test-path',
        children: [],
        disabled: false,
        authenticationRequired: false,
    };

    const mockNavOptionsWithChildren: NavOptionsModel = {
        label: 'test-label',
        path: '/test-path',
        children: [
            {
                label: 'test-child-1',
                path: '/test-path-1',
                children: null,
                disabled: false,
                authenticationRequired: false,
            },
        ],
        disabled: false,
        authenticationRequired: false,
    };

    const mockMenuPosition = {
        vertical: 'top' as 'top', // needed to remove typeerror
        horizontal: 'left' as 'left', // needed to remove typeerror
    };

    beforeEach(() => {
        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: mockgetAccessTokenSilently,
            isAuthenticated: false,
        });
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(
            <BrowserRouter>
                <NavbarPopupMenu navOption={mockNavOptions} menuPosition={mockMenuPosition} />
            </BrowserRouter>
        );
        const navOption = screen.getByText('test-label');
        expect(navOption).toBeInTheDocument();
    });

    it('should hide the menu button when not authenticated and authenticationRequired flag is set', () => {
        const mockNavOptions: NavOptionsModel = {
            label: 'test-label',
            path: '/test-path',
            children: [
                {
                    label: 'test-label-child-1',
                    path: 'test-path-child-1',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
                {
                    label: 'test-label-child-2',
                    path: 'test-path-child-2',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
            ],
            disabled: false,
            authenticationRequired: true,
        };

        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: mockgetAccessTokenSilently,
            isAuthenticated: false,
        });

        render(
            <BrowserRouter>
                <NavbarPopupMenu navOption={mockNavOptions} menuPosition={mockMenuPosition} />
            </BrowserRouter>
        );

        const button = screen.queryByText('test-label');
        expect(button).not.toBeInTheDocument();
    });

    it('should show the menu button when authenticated and authenticationRequired flag is set', () => {
        const mockNavOptions: NavOptionsModel = {
            label: 'test-label',
            path: '/test-path',
            children: [
                {
                    label: 'test-label-child-1',
                    path: 'test-path-child-1',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
                {
                    label: 'test-label-child-2',
                    path: 'test-path-child-2',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
            ],
            disabled: false,
            authenticationRequired: true,
        };

        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: mockgetAccessTokenSilently,
            isAuthenticated: true,
        });

        render(
            <BrowserRouter>
                <NavbarPopupMenu navOption={mockNavOptions} menuPosition={mockMenuPosition} />
            </BrowserRouter>
        );

        const button = screen.getByText('test-label');
        expect(button).toBeInTheDocument();
    });

    it('should disable the menu button when disable flag is set', () => {
        const mockNavOptions: NavOptionsModel = {
            label: 'test-label',
            path: '/test-path',
            children: [
                {
                    label: 'test-label-child-1',
                    path: 'test-path-child-1',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
                {
                    label: 'test-label-child-2',
                    path: 'test-path-child-2',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
            ],
            disabled: true,
            authenticationRequired: false,
        };

        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: mockgetAccessTokenSilently,
            isAuthenticated: false,
        });

        render(
            <BrowserRouter>
                <NavbarPopupMenu navOption={mockNavOptions} menuPosition={mockMenuPosition} />
            </BrowserRouter>
        );

        const button = screen.getByRole('button', { name: 'test-label' });
        expect(button).toBeDisabled();
    });

    it('should render the correct number of children', () => {
        const mockNavOptions: NavOptionsModel = {
            label: 'test-label',
            path: '/test-path',
            children: [
                {
                    label: 'test-label-child-1',
                    path: 'test-path-child-1',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
                {
                    label: 'test-label-child-2',
                    path: 'test-path-child-2',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
            ],
            disabled: false,
            authenticationRequired: false,
        };

        render(
            <BrowserRouter>
                <NavbarPopupMenu navOption={mockNavOptions} menuPosition={mockMenuPosition} />
            </BrowserRouter>
        );

        const menuitems = screen.getAllByRole('menuitem');
        expect(menuitems.length).toEqual((mockNavOptions.children as NavOptionsModel[]).length);
    });

    it('should disable the child when disabled flag is set', () => {
        const mockNavOptions: NavOptionsModel = {
            label: 'test-label',
            path: '/test-path',
            children: [
                {
                    label: 'test-label-child-1',
                    path: 'test-path-child-1',
                    children: null,
                    disabled: true,
                    authenticationRequired: false,
                },
                {
                    label: 'test-label-child-2',
                    path: 'test-path-child-2',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
            ],
            disabled: false,
            authenticationRequired: false,
        };

        render(
            <BrowserRouter>
                <NavbarPopupMenu navOption={mockNavOptions} menuPosition={mockMenuPosition} />
            </BrowserRouter>
        );

        const child1 = screen.getByRole('menuitem', { name: 'test-label-child-1' });
        expect(child1).toHaveAttribute('aria-disabled');
    });

    it('should show the menuitem when authenticated and authenticationRequired flag is set', () => {
        const mockNavOptions: NavOptionsModel = {
            label: 'test-label',
            path: '/test-path',
            children: [
                {
                    label: 'test-label-child-1',
                    path: 'test-path-child-1',
                    children: null,
                    disabled: false,
                    authenticationRequired: true,
                },
                {
                    label: 'test-label-child-2',
                    path: 'test-path-child-2',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
            ],
            disabled: false,
            authenticationRequired: false,
        };

        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: mockgetAccessTokenSilently,
            isAuthenticated: true,
        });

        render(
            <BrowserRouter>
                <NavbarPopupMenu navOption={mockNavOptions} menuPosition={mockMenuPosition} />
            </BrowserRouter>
        );

        const child1 = screen.queryByText('test-label-child-1');
        expect(child1).toBeInTheDocument();
    });

    it('should hide the menuitem when not authenticated and authenticationRequired flag is set', () => {
        const mockNavOptions: NavOptionsModel = {
            label: 'test-label',
            path: '/test-path',
            children: [
                {
                    label: 'test-label-child-1',
                    path: 'test-path-child-1',
                    children: null,
                    disabled: false,
                    authenticationRequired: true,
                },
                {
                    label: 'test-label-child-2',
                    path: 'test-path-child-2',
                    children: null,
                    disabled: false,
                    authenticationRequired: false,
                },
            ],
            disabled: false,
            authenticationRequired: false,
        };

        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: mockgetAccessTokenSilently,
            isAuthenticated: false,
        });

        render(
            <BrowserRouter>
                <NavbarPopupMenu navOption={mockNavOptions} menuPosition={mockMenuPosition} />
            </BrowserRouter>
        );

        const child1 = screen.queryByText('test-label-child-1');
        expect(child1).not.toBeInTheDocument();
    });

    it('should open the popup when main button is clicked', () => {
        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: mockgetAccessTokenSilently,
            isAuthenticated: true,
        });

        render(
            <BrowserRouter>
                <NavbarPopupMenu
                    navOption={mockNavOptionsWithChildren}
                    menuPosition={mockMenuPosition}
                />
            </BrowserRouter>
        );

        const button = screen.getByRole('button', { name: 'test-label' });
        userEvent.click(button);

        const mockPopper = screen.getByTestId('mock-popper-open');
        expect(mockPopper).toBeInTheDocument();
    });

    it('should close the popup when click away is triggered', () => {
        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: mockgetAccessTokenSilently,
            isAuthenticated: true,
        });

        render(
            <BrowserRouter>
                <NavbarPopupMenu
                    navOption={mockNavOptionsWithChildren}
                    menuPosition={mockMenuPosition}
                />
            </BrowserRouter>
        );

        // open the popper
        const button = screen.getByRole('button', { name: 'test-label' });
        userEvent.click(button);

        // close the popper
        const testTriggerClickAway = screen.getByTestId('trigger-click-away');
        userEvent.click(testTriggerClickAway);

        const mockPopper = screen.getByTestId('mock-popper-closed');
        expect(mockPopper).toBeInTheDocument();
    });

    it('should close the popup when a child menuitem is clicked', () => {
        (useAuth0 as any).mockReturnValue({
            getAccessTokenSilently: mockgetAccessTokenSilently,
            isAuthenticated: true,
        });

        render(
            <BrowserRouter>
                <NavbarPopupMenu
                    navOption={mockNavOptionsWithChildren}
                    menuPosition={mockMenuPosition}
                />
            </BrowserRouter>
        );

        // open the popper
        const button = screen.getByRole('button', { name: 'test-label' });
        userEvent.click(button);

        // close the popper
        const childMenuItems = screen.getByRole('menuitem', { name: 'test-child-1' });
        userEvent.click(childMenuItems);

        const mockPopper = screen.getByTestId('mock-popper-closed');
        expect(mockPopper).toBeInTheDocument();
    });
});
