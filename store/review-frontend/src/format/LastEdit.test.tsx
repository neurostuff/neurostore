import { render } from '@testing-library/react';
import { editSummary } from './editSummary';
import { LastEdit } from './LastEdit';

const now = new Date('2026-10-16T12:00:00Z');
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

describe('editSummary', () => {
    it('says how long ago the last edit was, and how many ops it took, with the right plural', () => {
        expect(editSummary(1, twoHoursAgo, now)).toBe('last edit 2 h ago, 1 op');
        expect(editSummary(2, twoHoursAgo, now)).toBe('last edit 2 h ago, 2 ops');
        expect(editSummary(0, twoHoursAgo, now)).toBe('last edit 2 h ago, 0 ops');
    });
});

describe('LastEdit', () => {
    it('shows the summary, with the exact time on hover', () => {
        const { container } = render(<LastEdit opCount={12} lastEditAt={twoHoursAgo} now={now} />);
        const edit = container.querySelector('[title]');
        expect(edit).toHaveTextContent('last edit 2 h ago, 12 ops');
        expect(edit).toHaveAttribute('title', new Date(twoHoursAgo).toLocaleString());
    });
});
