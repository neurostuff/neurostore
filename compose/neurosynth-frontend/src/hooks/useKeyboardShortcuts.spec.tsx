import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import useKeyboardShortcuts from './useKeyboardShortcuts';

const ShortcutHarness = ({
    enabled = true,
    onPromote = vi.fn(),
    onExclude = vi.fn(),
    onMoveDown = vi.fn(),
}: {
    enabled?: boolean;
    onPromote?: () => void;
    onExclude?: () => void;
    onMoveDown?: () => void;
}) => {
    useKeyboardShortcuts(
        {
            p: onPromote,
            e: onExclude,
            ArrowDown: onMoveDown,
        },
        enabled
    );

    return <div>shortcuts</div>;
};

describe('useKeyboardShortcuts', () => {
    it('calls the callback registered for the pressed key', async () => {
        const user = userEvent.setup();
        const onPromote = vi.fn();
        const onExclude = vi.fn();
        render(<ShortcutHarness onPromote={onPromote} onExclude={onExclude} />);

        await user.keyboard('p');
        await user.keyboard('e');

        expect(onPromote).toHaveBeenCalledTimes(1);
        expect(onExclude).toHaveBeenCalledTimes(1);
    });

    it('ignores keys that are not registered', async () => {
        const user = userEvent.setup();
        const onPromote = vi.fn();
        render(<ShortcutHarness onPromote={onPromote} />);

        await user.keyboard('x');

        expect(onPromote).not.toHaveBeenCalled();
    });

    it('ignores the shortcut when a modifier key is held', async () => {
        const user = userEvent.setup();
        const onPromote = vi.fn();
        render(<ShortcutHarness onPromote={onPromote} />);

        await user.keyboard('{Shift>}p{/Shift}');
        await user.keyboard('{Control>}p{/Control}');
        await user.keyboard('{Meta>}p{/Meta}');

        expect(onPromote).not.toHaveBeenCalled();
    });

    it('ignores the shortcut when an input is focused', async () => {
        const user = userEvent.setup();
        const onMoveDown = vi.fn();
        render(<ShortcutHarness onMoveDown={onMoveDown} />);
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        await user.keyboard('{ArrowDown}');

        expect(onMoveDown).not.toHaveBeenCalled();
        input.remove();
    });

    it('does not listen when disabled', async () => {
        const user = userEvent.setup();
        const onPromote = vi.fn();
        render(<ShortcutHarness enabled={false} onPromote={onPromote} />);

        await user.keyboard('p');

        expect(onPromote).not.toHaveBeenCalled();
    });

    it('uses the latest callback after rerender', async () => {
        const user = userEvent.setup();
        const firstPromote = vi.fn();
        const secondPromote = vi.fn();
        const { rerender } = render(<ShortcutHarness onPromote={firstPromote} />);

        rerender(<ShortcutHarness onPromote={secondPromote} />);
        await user.keyboard('p');

        expect(firstPromote).not.toHaveBeenCalled();
        expect(secondPromote).toHaveBeenCalledTimes(1);
    });
});
