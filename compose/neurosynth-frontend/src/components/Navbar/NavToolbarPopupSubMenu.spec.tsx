import { vi } from 'vitest';
import { fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavToolbarPopupSubMenu from './NavToolbarPopupSubMenu';

describe('NavToolbarPopupSubMenu', () => {
    const mockOptions = [
        {
            label: 'test-primary-text-1',
            secondary: 'test-secondary-text-1',
            onClick: vi.fn(),
        },
        {
            label: 'test-primary-text-2',
            secondary: 'test-secondary-text-2',
            onClick: vi.fn(),
        },
    ];

    it('should render', () => {
        render(<NavToolbarPopupSubMenu buttonProps={{}} buttonLabel="button-name" options={[]} />);
    });

    it('should not show the options by default', () => {
        render(
            <NavToolbarPopupSubMenu
                buttonProps={{}}
                buttonLabel="button-name"
                options={mockOptions}
            />
        );

        mockOptions.forEach((mockOption) => {
            expect(screen.queryByText(mockOption.label)).not.toBeInTheDocument();
            expect(screen.queryByText(mockOption.secondary)).not.toBeInTheDocument();
        });
    });

    it('should show the options when clicked', () => {
        render(
            <NavToolbarPopupSubMenu
                buttonProps={{}}
                buttonLabel="button-name"
                options={mockOptions}
            />
        );
        userEvent.click(screen.getByText('button-name'));

        mockOptions.forEach((mockOption) => {
            expect(screen.queryByText(mockOption.label)).toBeInTheDocument();
            expect(screen.queryByText(mockOption.secondary)).toBeInTheDocument();
        });
    });

    it('should hide the options when clicked away', async () => {
        render(
            <NavToolbarPopupSubMenu
                buttonProps={{}}
                buttonLabel="button-name"
                options={mockOptions}
            />
        );

        userEvent.click(screen.getByText('button-name'));

        // It is really annoying to test the Menu Popover. We must select the backdrop that is generated
        // and then get its first child, as that is what the click event listener is attached to.
        // UserEvent.click(documet.body) does not seem to work
        const backdrop = screen.getByRole('presentation').firstChild;
        if (!backdrop) fail('Expected backdrop but did not receive anything');

        // wait for menu to disappear
        fireEvent.click(backdrop);
        await waitForElementToBeRemoved(() => screen.queryByText(mockOptions[0].label));

        mockOptions.forEach((mockOption) => {
            expect(screen.queryByText(mockOption.label)).not.toBeInTheDocument();
            expect(screen.queryByText(mockOption.secondary)).not.toBeInTheDocument();
        });
    });

    it('should close the options menu when an option has been selected', async () => {
        render(
            <NavToolbarPopupSubMenu
                buttonProps={{}}
                buttonLabel="button-name"
                options={mockOptions}
            />
        );

        userEvent.click(screen.getByText('button-name'));

        userEvent.click(screen.getByText(mockOptions[0].label));

        await waitForElementToBeRemoved(() => screen.queryByText(mockOptions[0].label));

        mockOptions.forEach((mockOption) => {
            expect(screen.queryByText(mockOption.label)).not.toBeInTheDocument();
            expect(screen.queryByText(mockOption.secondary)).not.toBeInTheDocument();
        });
    });

    it('should call the click handler when the option has been clicked', () => {
        render(
            <NavToolbarPopupSubMenu
                buttonProps={{}}
                buttonLabel="button-name"
                options={mockOptions}
            />
        );

        userEvent.click(screen.getByText('button-name'));

        userEvent.click(screen.getByText(mockOptions[0].label));

        expect(mockOptions[0].onClick).toHaveBeenCalled();
    });
});
