import { render } from '@testing-library/react';
import NavDrawer from './NavDrawer';

describe('NavDrawer component', () => {
    it('should render', () => {
        render(<NavDrawer />);
    });

    it('should show limited options when not authenticated', () => {
        render(<NavDrawer />);
    });

    it('should show the full range of options when authenticated', () => {
        render(<NavDrawer />);
    });

    it('should login', () => {
        render(<NavDrawer />);
    });

    it('should logout', () => {
        render(<NavDrawer />);
    });

    it('should open the dialog when creating a new project', () => {
        render(<NavDrawer />);
    });

    it('should show the menu with the given menu items', () => {
        render(<NavDrawer />);
    });

    it('should hide the menu with the given menu items', () => {
        render(<NavDrawer />);
    });
});
