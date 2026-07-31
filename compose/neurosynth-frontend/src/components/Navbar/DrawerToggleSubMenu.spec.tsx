import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DrawerToggleSubMenu from './DrawerToggleSubMenu';

describe('DrawerToggleSubMenu', () => {
    it('should render', async () => {
        render(<DrawerToggleSubMenu labelText="test-label-text" />);
    });

    it('should show the correct text', async () => {
        render(<DrawerToggleSubMenu labelText="test-label-text" />);
        expect(screen.getByText('test-label-text')).toBeInTheDocument();
    });

    it('should expand and show children when clicked', async () => {
        render(
            <DrawerToggleSubMenu labelText="test-label-text">
                <span data-testid="mock-children">test-children</span>
            </DrawerToggleSubMenu>
        );

        expect(screen.queryByTestId('mock-children')).not.toBeInTheDocument();

        const subMenu = screen.getByRole('button');
        await userEvent.click(subMenu);
        expect(screen.queryByTestId('mock-children')).toBeInTheDocument();
    });

    it('should shrink when clicked after it has been expanded', async () => {
        render(
            <DrawerToggleSubMenu labelText="test-label-text">
                <span data-testid="mock-children">test-children</span>
            </DrawerToggleSubMenu>
        );

        expect(screen.queryByTestId('mock-children')).not.toBeInTheDocument();
        const subMenu = screen.getByRole('button');
        await userEvent.click(subMenu);
        expect(screen.queryByTestId('mock-children')).toBeInTheDocument();
        await userEvent.click(subMenu);
        expect(screen.queryByTestId('mock-children')).not.toBeInTheDocument();
    });
});
