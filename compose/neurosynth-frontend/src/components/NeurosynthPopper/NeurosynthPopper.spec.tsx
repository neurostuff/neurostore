import { vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import NeurosynthPopper from './NeurosynthPopper';

describe('NeurosynthPopper', () => {
    const mockOnClickAway = vi.fn();

    const MockParentComponent = (props: { open: boolean }) => {
        const mockButton = document.createElement('button');
        mockButton.innerHTML = 'click me!';
        document.body.appendChild(mockButton);

        return (
            <>
                <NeurosynthPopper open={props.open} onClickAway={mockOnClickAway} anchorElement={mockButton}>
                    <div>test</div>
                </NeurosynthPopper>
            </>
        );
    };

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should call the onClickAway handler', async () => {
        render(<MockParentComponent open={true} />);
        /**
         * We must mock the timers due to a bug with react: https://github.com/mui-org/material-ui/issues/24783
         */
        await act(async () => {
            vi.runAllTimers();
        });
        await act(async () => {
            fireEvent.click(document.body);
        });
        expect(mockOnClickAway).toHaveBeenCalled();
    });

    it('should render and show children when open', async () => {
        render(<MockParentComponent open={true} />);

        const child = screen.getByText('test');
        expect(child).toBeTruthy();
    });

    it('should not render children when closed', async () => {
        render(<MockParentComponent open={false} />);
        const child = screen.queryByText('test');
        expect(child).not.toBeInTheDocument();
    });
});
