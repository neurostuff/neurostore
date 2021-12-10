import { render, screen } from '@testing-library/react';
import { NeurosynthPopper } from '..';

describe('NeurosynthPopper', () => {
    const mockOnClickAway = jest.fn();
    it('should render', () => {
        render(
            <NeurosynthPopper open={true} onClickAway={mockOnClickAway} anchorElement={null}>
                <div>test</div>
            </NeurosynthPopper>
        );

        const child = screen.getByText('test');
        expect(child).toBeTruthy();
    });
});
