import { render } from '@testing-library/react';
import { StatusLabel } from './StatusLabel';

describe('StatusLabel', () => {
    it('names the reviewer who made the change, after the label', () => {
        const { container } = render(<StatusLabel id="edited" by="Ana" />);
        expect(container.textContent).toBe('edited by Ana');
        expect(container.querySelector('[data-status="edited"]')).toHaveAttribute('title', 'edited by Ana');
    });

    it('shows the label alone when no reviewer is named', () => {
        const { container } = render(<StatusLabel id="unchecked" />);
        expect(container.textContent).toBe('unchecked');
    });
});
