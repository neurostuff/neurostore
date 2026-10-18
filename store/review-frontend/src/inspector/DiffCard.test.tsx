import { act, fireEvent, screen, within } from '@testing-library/react';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { Inspector } from './FocusedCard';

const TEXT = 'x'.repeat(200);
const original = {
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [[50, 58]]), n: ev(20, [[60, 62]]) },
        { local_id: 'grp_b', name: ev('Controls', [[70, 78]]) },
    ],
};
const entities = entityRows(row('grp_a', 'Group', 'groups'), row('grp_b', 'Group', 'groups'));

function setup() {
    const record = structuredClone(original);
    record.groups[0].n = ev(24, [[60, 62]]);
    const view = renderWithStores(
        <Inspector />,
        makeBundle(record, TEXT, {
            entities,
            original: {
                record: { local_id: 'P1', ...original },
                coordinate_revision: null,
                entities,
                hidden: { analyses: [], entities: [] },
            },
        })
    );
    act(() => view.stores.view.getState().focusEntity('grp_a'));
    return view;
}

/** The diff row of the slot at `path`, which its field cell gives in a tooltip. */
const diffRow = (path: string) => screen.getAllByRole('row').find((row) => row.querySelector(`td[title="${path}"]`))!;

describe('the inspector while the diff is shown', () => {
    it('shows the entity’s card until the diff is on', () => {
        setup();
        expect(screen.queryByRole('table', { name: /original and review/ })).not.toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Patients' })).toBeInTheDocument();
    });

    it('shows the focused entity in two columns, original and review, with the changed slots marked', () => {
        const { stores } = setup();
        act(() => stores.view.getState().toggleDiff(true));
        const table = screen.getByRole('table', { name: 'Patients: original and review' });
        expect(
            within(table)
                .getAllByRole('columnheader')
                .map((h) => h.textContent)
        ).toEqual(['field', 'original', 'review', 'diff']);
        const n = diffRow('n');
        expect(
            within(n)
                .getAllByRole('cell')
                .map((c) => c.textContent)
        ).toEqual(['n', expect.stringContaining('20'), expect.stringContaining('24'), 'changed']);
        expect(n).toHaveAttribute('data-diff', 'changed');
        expect(diffRow('name')).toHaveAttribute('data-diff', 'same');
        expect(within(diffRow('name')).getAllByRole('cell')[3]).toHaveTextContent('');
    });

    it('focuses a slot from its row', () => {
        const { stores } = setup();
        act(() => stores.view.getState().toggleDiff(true));
        fireEvent.click(diffRow('n'));
        expect(stores.view.getState().focus.key).toBe('slot:grp_a:n');
        expect(diffRow('n')).toHaveAttribute('aria-current', 'true');
    });
});

describe('the diff card’s rows for links, slots only the original has, and slots the review added', () => {
    const base = {
        groups: [
            { local_id: 'grp_a', name: ev('Patients') },
            { local_id: 'grp_b', name: ev('Controls') },
        ],
        analyses: [
            {
                local_id: 'a_1',
                name: ev('Patients > Controls'),
                groups: [{ group: 'grp_a' }, { group: 'grp_b' }],
            },
        ],
    };
    const rows = entityRows(
        row('grp_a', 'Group', 'groups'),
        row('grp_b', 'Group', 'groups'),
        row('a_1', 'Analysis', 'analyses')
    );

    function show(change: (record: typeof base) => void, entity: string) {
        const record = structuredClone(base);
        change(record);
        const view = renderWithStores(
            <Inspector />,
            makeBundle(record, TEXT, {
                entities: rows,
                original: {
                    record: { local_id: 'P1', ...base },
                    coordinate_revision: null,
                    entities: rows,
                    hidden: { analyses: [], entities: [] },
                },
            })
        );
        act(() => view.stores.view.getState().focusEntity(entity));
        act(() => view.stores.view.getState().toggleDiff(true));
        return view;
    }

    const listRow = diffRow;

    it('marks a link slot changed when its link moved, with the names in its columns', () => {
        show((record) => {
            record.analyses[0].groups[0].group = 'grp_b';
        }, 'a_1');
        const link = listRow('groups[#0].group');
        expect(link).toHaveAttribute('data-diff', 'changed');
        expect(within(link).getAllByRole('cell')[1]).toHaveTextContent('Patients');
        expect(within(link).getAllByRole('cell')[2]).toHaveTextContent('Controls');
        expect(listRow('groups[#1].group')).toHaveAttribute('data-diff', 'same');
    });

    it('lists a slot only the original has as removed, with nothing in the review’s column', () => {
        show((record) => {
            record.analyses[0].groups.pop();
        }, 'a_1');
        const gone = listRow('groups[#1].group');
        expect(gone).toHaveAttribute('data-diff', 'removed');
        expect(within(gone).getAllByRole('cell')[1]).toHaveTextContent('Controls');
        expect(within(gone).getAllByRole('cell')[2]).toHaveTextContent('—');
    });

    it('marks a slot the review added as added', () => {
        show((record) => {
            (record.groups[1] as Record<string, unknown>).n = ev(12);
        }, 'grp_b');
        expect(diffRow('n')).toHaveAttribute('data-diff', 'added');
        expect(within(diffRow('n')).getAllByRole('cell')[3]).toHaveTextContent('added');
    });
});
