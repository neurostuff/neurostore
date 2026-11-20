import { fireEvent, render, screen } from '@testing-library/react';
import { Hint } from './Hint';

describe('a hint', () => {
    it('describes its control by the tooltip, and shows it on hover', async () => {
        render(
            <Hint title="Does the thing (t)">
                <button type="button">Do</button>
            </Hint>
        );
        const control = screen.getByRole('button', { name: 'Do' });
        expect(control).toHaveAttribute('title', 'Does the thing (t)');
        fireEvent.mouseOver(control);
        expect(await screen.findByRole('tooltip')).toHaveTextContent('Does the thing (t)');
        expect(control).toHaveAccessibleDescription('Does the thing (t)');
        expect(control).toHaveAccessibleName('Do');
    });

    it('sits where `placement` puts it', async () => {
        render(
            <Hint title="On the right" placement="right">
                <button type="button">Do</button>
            </Hint>
        );
        fireEvent.mouseOver(screen.getByRole('button', { name: 'Do' }));
        expect((await screen.findByRole('tooltip')).getAttribute('data-popper-placement')).toMatch(/^right/);
    });
});
