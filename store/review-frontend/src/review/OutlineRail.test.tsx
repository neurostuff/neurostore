import { act, fireEvent, screen, within } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
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
    const view = renderWithStores(<OutlineRail />, makeBundle(record, TEXT, { entities }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
    return view;
}
const names = () =>
    [...document.querySelectorAll<HTMLElement>('nav[aria-label="outline"] .MuiListItemButton-root')].map(
        (item) => item.textContent ?? ''
    );
const item = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('the outline rail’s status badges', () => {
    it('names the reviewer who made each change, in the badge', () => {
        const reviewers = [{ user_id: 'u1', name: 'Ana', state: 'in_progress' as const, op_count: 0, last_edit_at: null }];
        const view = renderWithStores(<OutlineRail />, makeBundle(record, TEXT, { entities, reviewers }));
        fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
        act(() => view.stores.session.setState({ provenance: { 'entity:grp_b': provenance('edited') } }));
        expect(within(item('Controls')).getByText('edited by Ana')).toBeInTheDocument();
    });

    it('shows each entity’s review status, unchecked until a person has looked at it', () => {
        const { stores } = setup();
        act(() =>
            stores.session.setState({
                provenance: {
                    'entity:grp_a': provenance('verified'),
                    'entity:grp_b': provenance('edited'),
                    'entity:grp_c': provenance('added'),
                    'entity:grp_d': provenance('removed'),
                },
            })
        );
        expect(within(item('Patients')).getByText('verified by u1')).toBeInTheDocument();
        expect(within(item('Controls')).getByText('edited by u1')).toBeInTheDocument();
        expect(within(item('Mixed')).getByText('added by u1')).toBeInTheDocument();
        expect(within(item('Ages')).getByText('rejected by u1')).toBeInTheDocument();
        expect(within(item('Left')).getByText('unchecked')).toBeInTheDocument();
    });
});

describe('the outline rail’s filters', () => {
    const filter = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));

    it('shows only the unreviewed entities', () => {
        const { stores } = setup();
        act(() =>
            stores.session.setState({
                provenance: { 'entity:grp_a': provenance('verified'), 'entity:grp_b': provenance('edited') },
            })
        );
        filter('unreviewed');
        expect(names().join('|')).toMatch(/Others/);
        expect(names().join('|')).toMatch(/Left/);
        expect(names().join('|')).not.toMatch(/Patients|Controls/);
    });

    it('shows only the entities that were edited, added or removed', () => {
        const { stores } = setup();
        act(() =>
            stores.session.setState({
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

    it('shows as changed an entity whose slot differs from the original, with no review status on the entity', () => {
        const edited = structuredClone(record);
        edited.groups[5].name = ev('Left handed');
        renderWithStores(
            <OutlineRail />,
            makeBundle(edited, TEXT, {
                entities,
                original: { record: { local_id: 'P1', ...record }, entities, hidden: { analyses: [], entities: [] } },
            })
        );
        fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
        filter('changed');
        expect(names()).toHaveLength(1);
        expect(names()[0]).toMatch(/^Left handed/);
    });

    const withOriginal = (edited: typeof record, review = entities) => {
        renderWithStores(
            <OutlineRail />,
            makeBundle(edited, TEXT, {
                entities: review,
                original: { record: { local_id: 'P1', ...record }, entities, hidden: { analyses: [], entities: [] } },
            })
        );
        fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
        filter('changed');
    };

    it('shows as changed an entity that lost a slot the original had', () => {
        const original = { ...record, groups: [...record.groups, { local_id: 'grp_g', name: ev('Ages 2'), n: ev(3) }] };
        const rows = entityRows(
            ...entities.slice(1).map((r) => row(r.local_id, 'Group', 'groups')),
            row('grp_g', 'Group', 'groups')
        );
        const edited = structuredClone(original);
        delete (edited.groups[6] as Record<string, unknown>).n;
        renderWithStores(
            <OutlineRail />,
            makeBundle(edited, TEXT, {
                entities: rows,
                original: {
                    record: { local_id: 'P1', ...original },
                    entities: rows,
                    hidden: { analyses: [], entities: [] },
                },
            })
        );
        fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
        filter('changed');
        expect(names()).toHaveLength(1);
        expect(names()[0]).toMatch(/^Ages 2/);
    });

    it('shows as changed an entity only the review has, and not one that is the same', () => {
        const edited = structuredClone(record);
        edited.groups.push({ local_id: 'grp_g', name: ev('New group') });
        withOriginal(
            edited,
            entityRows(
                ...entities.slice(1).map((r) => row(r.local_id, 'Group', 'groups')),
                row('grp_g', 'Group', 'groups')
            )
        );
        expect(names()).toHaveLength(1);
        expect(names()[0]).toMatch(/^New group/);
    });

    it('shows as changed an entity the reviewer rejected, whatever the original holds', () => {
        const { stores } = renderWithStores(<OutlineRail />, makeBundle(record, TEXT, { entities }));
        fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
        act(() => stores.session.setState({ provenance: { 'entity:grp_f': provenance('removed') } }));
        filter('changed');
        expect(names()).toHaveLength(1);
        expect(names()[0]).toMatch(/^Left/);
    });

    it('shows only the entities with a note on them, from the saved or pending ops', () => {
        const { stores } = setup();
        const note = {
            client_op_id: 'note-0001',
            type: 'note',
            target: { kind: 'entity', entity: 'grp_e' },
            note: 'check',
        };
        act(() => stores.session.setState({ pending: [note as unknown as Op] }));
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
        const { stores } = setup();
        filter('doubtful');
        filter('doubtful');
        expect(stores.view.getState().outlineFilter).toBe('all');
        expect(names().join('|')).toMatch(/Patients/);
    });

    it('keeps the filter for the session when the rail is closed and opened again', () => {
        const { stores } = setup();
        filter('doubtful');
        fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
        fireEvent.click(screen.getByRole('button', { name: 'toggle outline' }));
        expect(stores.view.getState().outlineFilter).toBe('doubtful');
        expect(screen.getByRole('button', { name: 'doubtful' })).toHaveAttribute('aria-pressed', 'true');
    });
});
