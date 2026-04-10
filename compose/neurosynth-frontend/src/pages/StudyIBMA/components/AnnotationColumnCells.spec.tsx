import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnnotationColumnCell } from './AnnotationColumnCells';

describe('AnnotationColumnCell', () => {
    it('commits boolean annotation changes', () => {
        const onCommit = vi.fn();
        render(
            <AnnotationColumnCell
                rowId="row-1"
                rowKind="analysis"
                field="included"
                type="boolean"
                headerLabel="Included"
                initialValue={false}
                onCommit={onCommit}
            />
        );
        userEvent.click(screen.getByRole('checkbox', { name: 'Included' }));
        expect(onCommit).toHaveBeenCalledWith('row-1', 'included', true);
    });

    it('renders a spacer for detail rows', () => {
        const { container } = render(
            <AnnotationColumnCell
                rowId="detail-1"
                rowKind="detail"
                field="included"
                type="boolean"
                headerLabel="Included"
                initialValue={false}
                onCommit={vi.fn()}
            />
        );
        expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    });
});
