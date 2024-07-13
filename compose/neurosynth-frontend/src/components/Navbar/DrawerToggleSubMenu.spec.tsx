import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DrawerToggleSubMenu from './DrawerToggleSubMenu';

describe('DrawerToggleSubMenu', () => {
    it('should render', () => {
        render(<DrawerToggleSubMenu labelText="test-label-text" />);
    });

    it('should show the correct text', () => {
        render(<DrawerToggleSubMenu labelText="test-label-text" />);
        expect(screen.getByText('test-label-text')).toBeInTheDocument();
    });

    it('should expand and show children when clicked', () => {
        render(
            <DrawerToggleSubMenu labelText="test-label-text">
                <span data-testid="mock-children">test-children</span>
            </DrawerToggleSubMenu>
        );

        expect(screen.queryByTestId('mock-children')).not.toBeInTheDocument();

        const subMenu = screen.getByRole('button');
        userEvent.click(subMenu);
        expect(screen.queryByTestId('mock-children')).toBeInTheDocument();
    });

    it('should shrink when clicked after it has been expanded', () => {
        render(
            <DrawerToggleSubMenu labelText="test-label-text">
                <span data-testid="mock-children">test-children</span>
            </DrawerToggleSubMenu>
        );

        expect(screen.queryByTestId('mock-children')).not.toBeInTheDocument();
        const subMenu = screen.getByRole('button');
        userEvent.click(subMenu);
        expect(screen.queryByTestId('mock-children')).toBeInTheDocument();
        userEvent.click(subMenu);
        expect(screen.queryByTestId('mock-children')).not.toBeInTheDocument();
    });
});
