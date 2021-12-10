import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { act } from 'react-dom/test-utils';
import { NeurosynthPopper } from '..';

describe('NeurosynthPopper', () => {
    const mockOnClickAway = jest.fn();

    const MockParentComponent: React.FC<{ open: boolean }> = (props) => {
        const mockButton = document.createElement('button');
        mockButton.innerHTML = 'click me!';
        document.body.appendChild(mockButton);

        return (
            <>
                <NeurosynthPopper
                    open={props.open}
                    onClickAway={mockOnClickAway}
                    anchorElement={mockButton}
                >
                    <div>test</div>
                </NeurosynthPopper>
            </>
        );
    };

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should call the onClickAway handler', () => {
        render(<MockParentComponent open={true} />);
        /**
         * We must mock the timers due to a bug with react: https://github.com/mui-org/material-ui/issues/24783
         */
        jest.runAllTimers();
        userEvent.click(document.body);
        expect(mockOnClickAway).toHaveBeenCalled();
    });

    it('should render and show children when open', () => {
        render(<MockParentComponent open={true} />);

        const child = screen.getByText('test');
        expect(child).toBeTruthy();
    });

    it('should not render children when closed', () => {
        render(<MockParentComponent open={false} />);
        const child = screen.queryByText('test');
        expect(child).not.toBeInTheDocument();
    });
});
