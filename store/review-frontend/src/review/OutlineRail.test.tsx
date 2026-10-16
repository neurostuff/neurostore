import { act, fireEvent, screen, within } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStore } from '../test/render';
import { OutlineRail } from './OutlineRail';

const TEXT = 'We scanned twenty patients and twenty controls on a 3 T scanner.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const record = {
    description: ev('fMRI study', [at('scanned')]),
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [at('patients')]) },
        { local_id: 'grp_b', name: ev('Controls') },
        { local_id: 'grp_c', name: ev('Mixed', [at('twenty')]) },
        { local_id: 'grp_d', name: ev('Ages', [at('scanner')]) },
        { local_id: 'grp_e', name: ev('Others', [at('controls')]) },
        { local_id: 'grp_f', name: ev('Left') },
    ],
};

const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('grp_c', 'Group', 'groups'),
    row('grp_d', 'Group', 'groups'),
    row('grp_e', 'Group', 'groups'),
    row('grp_f', 'Group', 'groups')
);

const provenance = (state: 'verified' | 'edited' | 'added' | 'removed') => ({ state, user_id: 'u1', at: '' });

function setup() {
    const view = renderWithStore(<OutlineRail />, makeBundle(record, TEXT, { entities }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
    return view;
}
const names = () =>
    [...document.querySelectorAll<HTMLElement>('nav[aria-label="outline"] .MuiListItemButton-root')].map(
        (item) => item.textContent ?? ''
    );
const item = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('the outline rail’s status badges', () => {
    it('shows each entity’s review status, unchecked until a person has looked at it', () => {
        const { store } = setup();
        act(() =>
            store.setState({
                provenance: {
                    'entity:grp_a': provenance('verified'),
                    'entity:grp_b': provenance('edited'),
                    'entity:grp_c': provenance('added'),
                    'entity:grp_d': provenance('removed'),
                },
            })
        );
        expect(within(item('Patients')).getByText('verified')).toBeInTheDocument();
        expect(within(item('Controls')).getByText('edited')).toBeInTheDocument();
        expect(within(item('Mixed')).getByText('added')).toBeInTheDocument();
        expect(within(item('Ages')).getByText('rejected')).toBeInTheDocument();
        expect(within(item('Left')).getByText('unchecked')).toBeInTheDocument();
    });
});

describe('the outline rail’s filters', () => {
    const filter = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));

    it('shows only the unreviewed entities', () => {
        const { store } = setup();
        act(() =>
            store.setState({
                provenance: { 'entity:grp_a': provenance('verified'), 'entity:grp_b': provenance('edited') },
            })
        );
        filter('unreviewed');
        expect(names().join('|')).toMatch(/Others/);
        expect(names().join('|')).toMatch(/Left/);
        expect(names().join('|')).not.toMatch(/Patients|Controls/);
    });

    it('shows only the entities that were edited, added or removed', () => {
        const { store } = setup();
        act(() =>
            store.setState({
                provenance: {
                    'entity:grp_b': provenance('edited'),
                    'entity:grp_c': provenance('added'),
                    'entity:grp_d': provenance('removed'),
                },
            })
        );
        filter('changed');
        expect(names().join('|')).toMatch(/Controls/);
        expect(names().join('|')).toMatch(/Mixed/);
        expect(names().join('|')).toMatch(/Ages/);
        expect(names().join('|')).not.toMatch(/Patients|Others|Left/);
    });

    it('shows only the entities with a note on them, from the saved or pending ops', () => {
        const { store } = setup();
        const note = {
            client_op_id: 'note-0001',
            type: 'note',
            target: { kind: 'entity', entity: 'grp_e' },
            note: 'check',
        };
        act(() => store.setState({ pending: [note as unknown as Op] }));
        filter('noted');
        expect(names()).toHaveLength(1);
        expect(names()[0]).toMatch(/^Others/);
    });

    it('shows only the entities with a doubtful slot: no evidence found, generated or ambiguous', () => {
        setup();
        filter('doubtful');
        expect(names().join('|')).toMatch(/Controls/);
        expect(names().join('|')).toMatch(/Left/);
        expect(names().join('|')).not.toMatch(/Patients|Mixed|Ages|Others/);
    });

    it('shows everything again when the active filter is pressed a second time', () => {
        const { store } = setup();
        filter('doubtful');
        filter('doubtful');
        expect(store.getState().outlineFilter).toBe('all');
        expect(names().join('|')).toMatch(/Patients/);
    });

    it('keeps the filter for the session when the rail is closed and opened again', () => {
        const { store } = setup();
        filter('doubtful');
        fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
        fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
        expect(store.getState().outlineFilter).toBe('doubtful');
        expect(screen.getByRole('button', { name: 'doubtful' })).toHaveAttribute('aria-pressed', 'true');
    });
});
