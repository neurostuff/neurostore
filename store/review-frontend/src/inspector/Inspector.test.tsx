import { getContrastRatio } from '@mui/material/styles';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { theme } from '../theme';
import { Inspector } from './FocusedCard';
import { STATUSES } from './status';
import { openPanelOn } from './openPanel';

const TEXT = 'x'.repeat(200);

const record = {
    local_id: 'study-1',
    groups: [{ local_id: 'grp_a', name: ev('Patients', [[50, 58]]) }],
    acquisitions: [{ local_id: 'acq_1', acquisition_type: 'MRI', modality: ev('fMRI', [[70, 74]]) }],
    measures: [{ local_id: 'mea_1', source_label: ev('BOLD', [[80, 84]]) }],
    analyses: [
        {
            local_id: 'a_1',
            name: ev('Patients > Controls', [[120, 140]]),
            definition: ev('def', [[150, 160]], 'generated'),
            prespecification: notReported(),
            outcome: {
                extraction_status: 'extracted',
                value: 'x',
                value_source: 'reported',
                evidence: { status: 'not_found' },
            },
            spatial_scope: notReported('outside_text'),
            measure: 'mea_1',
            acquisitions: ['acq_1'],
            groups: [{ group: 'grp_a', n: ev(20, [[100, 102]]) }],
        },
    ],
};

const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('acq_1', 'Acquisition', 'acquisitions', { schema_class: 'MRI' }),
    row('mea_1', 'Measure', 'measures'),
    row('a_1', 'Analysis', 'analyses')
);

function setup(entity = 'a_1') {
    const view = renderWithStores(<Inspector />, makeBundle(record, TEXT, { entities }));
    act(() => view.stores.view.getState().focusEntity(entity));
    return view;
}

const rows = () => screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-slot-key'));
const rowOf = (key: string) => rows().find((row) => row.getAttribute('data-slot-key') === key)!;
const shapeIn = (row: HTMLElement) => row.querySelector('[data-status-shape]');

describe('Inspector', () => {
    it('names the reviewer who made each change, on the slot’s badge and the entity’s', () => {
        const view = setup();
        act(() =>
            view.stores.session.setState({
                bundle: {
                    ...view.stores.session.getState().bundle,
                    reviewers: [{ user_id: 'u1', name: 'Ana', state: 'in_progress', op_count: 0, last_edit_at: null }],
                },
                provenance: {
                    'slot:a_1:name': { state: 'edited', user_id: 'u1', at: 'then' },
                    'entity:a_1': { state: 'verified', user_id: 'u1', at: 'then' },
                },
            })
        );
        expect(rowOf('slot:a_1:name')).toHaveTextContent('edited by Ana');
        expect(screen.getByText('verified by Ana')).toBeInTheDocument();
    });

    it('shows the focused entity’s class and name, with its local id in a tooltip', () => {
        setup();
        const card = screen.getByRole('region', { name: 'Patients > Controls' });
        expect(within(card).getByText('Analysis')).toBeInTheDocument();
        expect(within(card).getByRole('heading', { name: 'Patients > Controls' })).toHaveAttribute('title', 'a_1');
    });

    it('labels each slot by its name and a list item by the entity it refers to, the path only in a tooltip', () => {
        setup();
        const label = (key: string) => rowOf(key).querySelector('.rv-slot-label')!;
        expect(label('slot:a_1:groups[#0].n')).toHaveTextContent('Patients: n');
        expect(label('slot:a_1:groups[#0].n')).toHaveAttribute('title', 'groups[#0].n');
        expect(label('slot:a_1:spatial_scope')).toHaveTextContent('Spatial scope');
        expect(screen.queryByText(/\[#\d+\]/)).not.toBeInTheDocument();
    });

    it('shows the entity’s local id in a tooltip on its name, not as text', () => {
        setup();
        const card = screen.getByRole('region', { name: 'Patients > Controls' });
        expect(within(card).queryByText('a_1')).not.toBeInTheDocument();
        expect(within(card).getByRole('heading', { name: 'Patients > Controls' })).toHaveAttribute('title', 'a_1');
    });

    it('names a reference chip’s entity by its name, with its local id in a tooltip', () => {
        setup();
        expect(within(rowOf('slot:a_1:measure')).getByRole('button', { name: 'BOLD' })).toHaveAttribute(
            'title',
            'mea_1'
        );
    });

    it('explains each status in a tooltip, and in a legend on the card', () => {
        setup();
        expect(shapeIn(rowOf('slot:a_1:definition'))).toHaveAttribute(
            'title',
            'value generated: the model worked the value out; check it against the text'
        );
        const legend = screen.getByRole('list', { name: 'what the marks mean' });
        expect(
            within(legend)
                .getAllByRole('listitem')
                .map((li) => li.textContent)
        ).toEqual([
            'evidence present',
            'evidence not found',
            'value generated',
            'not reported (ambiguous)',
            'not reported',
            'not in the record',
            'reference',
        ]);
    });

    it('renders a list value as a list of its values, not as JSON', () => {
        const view = renderWithStores(
            <Inspector />,
            makeBundle(
                {
                    groups: [
                        { local_id: 'grp_a', name: ev('Patients'), inclusion_criteria: ev(['18 or older', 'SAD']) },
                    ],
                },
                TEXT,
                {
                    entities: entityRows(row('grp_a', 'Group', 'groups')),
                }
            )
        );
        act(() => view.stores.view.getState().focusEntity('grp_a'));
        const value = within(rowOf('slot:grp_a:inclusion_criteria')).getByRole('list');
        expect(
            within(value)
                .getAllByRole('listitem')
                .map((li) => li.textContent)
        ).toEqual(['18 or older', 'SAD']);
        expect(rowOf('slot:grp_a:inclusion_criteria')).not.toHaveTextContent('[');
    });

    it('accepts every untouched slot with evidence from the card’s own button, as Shift+A does', () => {
        const { stores } = setup();
        const card = screen.getByRole('region', { name: 'Patients > Controls' });
        fireEvent.click(within(card).getByRole('button', { name: 'Accept all with evidence' }));
        const accepted = stores.session
            .getState()
            .pending.map((op) => (op.type === 'verdict' && op.target.kind === 'slot' ? op.target.path : ''));
        expect(accepted.sort()).toEqual(['definition', 'groups[#0].n', 'name']);
    });

    it('shows a group the n each analysis using it analysed, read-only, with a link to the analysis (C2)', () => {
        const { stores } = setup('grp_a');
        const analysed = screen.getByRole('list', { name: 'analysed n' });
        expect(analysed).toHaveTextContent('n analysed: 20, in Patients > Controls');
        expect(within(analysed).queryByRole('textbox')).not.toBeInTheDocument();
        fireEvent.click(within(analysed).getByRole('button', { name: 'open Patients > Controls' }));
        expect(stores.view.getState().focus.key).toBe('slot:a_1:groups[#0].n');
    });

    it('shows no analysed n on an entity no analysis counts', () => {
        setup('mea_1');
        expect(screen.queryByRole('list', { name: 'analysed n' })).not.toBeInTheDocument();
    });

    it('names the schema class beside the entity class where they differ', () => {
        setup('acq_1');
        expect(screen.getByText('Acquisition · MRI')).toBeInTheDocument();
    });

    it('shows the record’s local id where it differs from the entity id', () => {
        setup('study');
        const card = screen.getByRole('region', { name: 'Study' });
        expect(within(card).getByRole('heading', { name: 'Study' })).toHaveAttribute('title', 'study-1');
    });

    it('lists the slots in the order the schema declares them, each with a status shape, a visible status label and its value', () => {
        setup();
        const inRecord = [
            'slot:a_1:acquisitions',
            'slot:a_1:definition',
            'slot:a_1:groups[#0].group',
            'slot:a_1:groups[#0].n',
            'slot:a_1:measure',
            'slot:a_1:name',
            'slot:a_1:outcome',
            'slot:a_1:prespecification',
            'slot:a_1:spatial_scope',
        ];
        expect(
            rows()
                .map((row) => row.getAttribute('data-slot-key')!)
                .filter((key) => inRecord.includes(key))
        ).toEqual(inRecord);
        const statusOf = (key: string) => [
            key,
            shapeIn(rowOf(key))?.textContent,
            shapeIn(rowOf(key))?.getAttribute('data-status-shape'),
        ];
        const doubtful = ['outcome', 'definition', 'prespecification', 'name', 'spatial_scope', 'measure'];
        expect(doubtful.map((path) => statusOf(`slot:a_1:${path}`))).toEqual([
            ['slot:a_1:outcome', 'evidence not found', 'ring'],
            ['slot:a_1:definition', 'value generated', 'triangle'],
            ['slot:a_1:prespecification', 'not reported (ambiguous)', 'diamond'],
            ['slot:a_1:name', 'evidence present', 'circle'],
            ['slot:a_1:spatial_scope', 'not reported', 'bar'],
            ['slot:a_1:measure', 'reference', 'square'],
        ]);
        expect(rowOf('slot:a_1:name')).toHaveTextContent('Patients > Controls');
        expect(rowOf('slot:a_1:spatial_scope')).toHaveTextContent('not reported (outside_text)');
    });

    it('says where a slot has no schema, instead of guessing an editor', () => {
        const view = renderWithStores(
            <Inspector />,
            makeBundle({ groups: [{ local_id: 'grp_a', name: ev('Patients'), mystery: ev('x') }] }, TEXT, {
                entities: entityRows(row('grp_a', 'Group', 'groups')),
            })
        );
        act(() => {
            view.stores.view.getState().focusSlot('slot:grp_a:mystery');
            openPanelOn(view.stores, 'edit');
        });
        expect(screen.getByText('no schema for this slot')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'edit Mystery' })).not.toBeInTheDocument();
    });

    it('lists the slots the class declares that the record leaves out, after the record’s', () => {
        setup();
        expect(rowOf('slot:a_1:assessments')).toHaveTextContent('—');
        expect(rowOf('slot:a_1:coordinate_space')).toHaveTextContent('not in the record');
    });

    it('labels a declared slot the record leaves out as not in the record, not as evidence not found', () => {
        setup();
        expect(shapeIn(rowOf('slot:a_1:coordinate_space'))?.textContent).toBe('not in the record');
        expect(shapeIn(rowOf('slot:a_1:coordinate_space'))?.getAttribute('data-status')).toBe('absent');
    });

    it('gives every status its own shape', () => {
        const shapes = Object.values(STATUSES).map((status) => status.shape);
        expect(new Set(shapes).size).toBe(shapes.length);
    });

    it.each([
        ['evidence not found', 5.28],
        ['value generated', 3.56],
        ['not reported (ambiguous)', 3.56],
        ['not reported', 6.48],
        ['evidence present', 5.25],
        ['reference', 4.86],
        ['verified', 5.25],
        ['edited', 4.86],
        ['rejected', 5.28],
        ['added', 4.86],
    ])('draws “%s” in a colour of %f:1 on white, at least 3:1', (label, ratio) => {
        const status = Object.values(STATUSES).find((s) => s.label === label)!;
        const measured = getContrastRatio(status.color(theme.palette), '#ffffff');
        expect(measured).toBeCloseTo(ratio, 2);
        expect(measured).toBeGreaterThanOrEqual(3);
    });

    it('renders reference slots as chips naming their targets, and a chip focuses its entity', () => {
        const { stores } = setup();
        expect(within(rowOf('slot:a_1:measure')).getByRole('button', { name: 'BOLD' })).toBeInTheDocument();
        fireEvent.click(within(rowOf('slot:a_1:groups[#0].group')).getByRole('button', { name: 'Patients' }));
        expect(stores.view.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
        expect(screen.getByRole('region', { name: 'Patients' })).toBeInTheDocument();
    });

    it('focuses a slot when it is clicked', () => {
        const { stores } = setup();
        fireEvent.click(within(rowOf('slot:a_1:name')).getByText('Name'));
        expect(stores.view.getState().focus).toEqual({ entity: 'a_1', key: 'slot:a_1:name', slot: 'slot:a_1:name' });
        expect(rowOf('slot:a_1:name')).toHaveAttribute('aria-current', 'true');
    });

    it('updates a slot’s status when evidence is added, and keeps the row in its place', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:a_1:outcome'));
        const at = rows().indexOf(rowOf('slot:a_1:outcome'));
        act(() => void stores.session.getState().addEvidence(stores.view.getState().focus.key, [10, 20], 'first'));
        expect(rows()[at]).toHaveAttribute('data-slot-key', 'slot:a_1:outcome');
        expect(shapeIn(rows()[at])).toHaveTextContent('evidence present');
        act(() => stores.view.getState().focusSlot('slot:a_1:definition'));
        expect(rows()[at]).toHaveAttribute('data-slot-key', 'slot:a_1:outcome');
    });
});
