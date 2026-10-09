import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import PrivacyToggle from './PrivacyToggle';

describe('PrivacyToggle', () => {
    it('shows public and private options for editors of a public resource', () => {
        render(<PrivacyToggle isPublic={true} canEdit={true} onChange={() => {}} />);

        expect(screen.getByRole('button', { name: /Public/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Private/ })).toBeInTheDocument();
    });

    it('calls onChange with false when an editor selects Private', async () => {
        const onChange = vi.fn();
        render(<PrivacyToggle isPublic={true} canEdit={true} onChange={onChange} />);

        await userEvent.click(screen.getByRole('button', { name: /Private/ }));

        expect(onChange).toHaveBeenCalledWith(false);
    });

    it('calls onChange with true when an editor selects Public', async () => {
        const onChange = vi.fn();
        render(<PrivacyToggle isPublic={false} canEdit={true} onChange={onChange} />);

        await userEvent.click(screen.getByRole('button', { name: /Public/ }));

        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('shows a disabled public button for non-editors of a public resource', () => {
        render(<PrivacyToggle isPublic={true} canEdit={false} onChange={() => {}} />);

        expect(screen.getByRole('button', { name: /Public/ })).toBeDisabled();
        expect(screen.queryByRole('button', { name: /Private/ })).not.toBeInTheDocument();
    });

    it('shows a disabled private button for non-editors of a private resource', () => {
        render(<PrivacyToggle isPublic={false} canEdit={false} onChange={() => {}} />);

        expect(screen.getByRole('button', { name: /Private/ })).toBeDisabled();
        expect(screen.queryByRole('button', { name: /Public/ })).not.toBeInTheDocument();
    });

    it('shows a loading indicator instead of the toggle when isLoading is true', () => {
        render(<PrivacyToggle isPublic={true} canEdit={true} onChange={() => {}} isLoading />);

        expect(screen.getByRole('progressbar', { name: 'Updating privacy' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Public/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Private/ })).not.toBeInTheDocument();
    });
});
