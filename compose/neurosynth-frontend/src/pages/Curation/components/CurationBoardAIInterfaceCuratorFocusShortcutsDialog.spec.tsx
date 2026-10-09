import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUserCanEdit } from 'hooks';
import { useParams } from 'react-router-dom';
import { useProjectUser } from 'stores/projects/ProjectStore';
import { Mock, vi } from 'vitest';
import CurationBoardAIInterfaceCuratorFocusShortcutsDialog, {
    getCurationFocusModeSeenStorageKey,
} from './CurationBoardAIInterfaceCuratorFocusShortcutsDialog';

vi.mock('@auth0/auth0-react');
vi.mock('react-router-dom');
vi.mock('components/Dialogs/BaseDialog');
vi.mock('hooks');
vi.mock('stores/projects/ProjectStore');

const storageKey = getCurationFocusModeSeenStorageKey('some-github-user', 'test-project-id');

describe('CurationBoardAIInterfaceCuratorFocusShortcutsDialog', () => {
    beforeEach(() => {
        localStorage.clear();
        (useAuth0 as Mock).mockReturnValue({ user: { sub: 'some-github-user' } });
        (useParams as Mock).mockReturnValue({ projectId: 'test-project-id' });
        (useProjectUser as Mock).mockReturnValue('some-github-user');
        (useUserCanEdit as Mock).mockReturnValue(true);
    });

    it('shows the shortcut keys the first time this user opens focus mode for the project', () => {
        render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent('Focus mode shortcuts');
        expect(screen.getAllByText(/^(Review|Navigate)$/).map((heading) => heading.textContent)).toEqual([
            'Review',
            'Navigate',
        ]);
        expect(screen.getByText('Previous study')).toBeInTheDocument();
        expect(screen.getByText('Next study')).toBeInTheDocument();
        expect(screen.getByText('Scroll up')).toBeInTheDocument();
        expect(screen.getByText('Scroll down')).toBeInTheDocument();
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('Include or promote')).toBeInTheDocument();
        expect(screen.getByText('S')).toBeInTheDocument();
        expect(screen.getByText('Exclude')).toBeInTheDocument();
        expect(screen.getByText('D')).toBeInTheDocument();
        expect(screen.getByText('Demote')).toBeInTheDocument();
        expect(screen.getByText('E')).toBeInTheDocument();
        expect(screen.getByText('Expand or collapse details')).toBeInTheDocument();
    });

    it('hides include, exclude, and demote shortcuts when the user cannot edit', () => {
        (useUserCanEdit as Mock).mockReturnValue(false);

        render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        expect(screen.queryByText('A')).not.toBeInTheDocument();
        expect(screen.queryByText('Include or promote')).not.toBeInTheDocument();
        expect(screen.queryByText('S')).not.toBeInTheDocument();
        expect(screen.queryByText('Exclude')).not.toBeInTheDocument();
        expect(screen.queryByText('D')).not.toBeInTheDocument();
        expect(screen.queryByText('Demote')).not.toBeInTheDocument();
        expect(screen.getByText('Review')).toBeInTheDocument();
        expect(screen.getByText('E')).toBeInTheDocument();
        expect(screen.getByText('Expand or collapse details')).toBeInTheDocument();
        expect(screen.getByText('Navigate')).toBeInTheDocument();
        expect(screen.getByText('Previous study')).toBeInTheDocument();
        expect(screen.getByText('Next study')).toBeInTheDocument();
        expect(screen.getByText('Scroll up')).toBeInTheDocument();
        expect(screen.getByText('Scroll down')).toBeInTheDocument();
    });

    it('stays closed after this user has already seen focus mode for the project', () => {
        localStorage.setItem(storageKey, 'true');

        render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();
    });

    it('still opens for a different project', () => {
        localStorage.setItem(getCurationFocusModeSeenStorageKey('some-github-user', 'other-project'), 'true');

        render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        expect(screen.getByTestId('mock-base-dialog')).toBeInTheDocument();
    });

    it('still opens for a different user on the same project', () => {
        localStorage.setItem(getCurationFocusModeSeenStorageKey('other-user', 'test-project-id'), 'true');

        render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        expect(screen.getByTestId('mock-base-dialog')).toBeInTheDocument();
    });

    it('closes without saving when Dont show this again is unchecked', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        await user.click(screen.getByRole('button', { name: 'Understood' }));

        expect(localStorage.getItem(storageKey)).toBeNull();
        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();

        unmount();
        render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        expect(screen.getByTestId('mock-base-dialog')).toBeInTheDocument();
    });

    it('saves the dismissal for a non-authenticated user', async () => {
        const user = userEvent.setup();
        (useAuth0 as Mock).mockReturnValue({ user: undefined });
        const nonAuthenticatedStorageKey = getCurationFocusModeSeenStorageKey(
            'non-authenticated-user',
            'test-project-id'
        );
        const { unmount } = render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        await user.click(screen.getByRole('checkbox', { name: "Don't show this again" }));
        await user.click(screen.getByRole('button', { name: 'Understood' }));

        expect(localStorage.getItem(nonAuthenticatedStorageKey)).toBe('true');
        expect(localStorage.getItem(storageKey)).toBeNull();

        unmount();
        render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();
    });

    it('saves the dismissal when Dont show this again is checked', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        await user.click(screen.getByRole('checkbox', { name: "Don't show this again" }));
        await user.click(screen.getByRole('button', { name: 'Understood' }));

        expect(localStorage.getItem(storageKey)).toBe('true');

        unmount();
        render(<CurationBoardAIInterfaceCuratorFocusShortcutsDialog />);

        expect(screen.queryByTestId('mock-base-dialog')).not.toBeInTheDocument();
    });
});
