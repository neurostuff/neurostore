import { getContrastRatio } from '@mui/material/styles';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import { renderWithStore } from '../test/render';
import { theme } from '../theme';
import { Inspector } from './FocusedCard';
import { STATUSES } from './status';

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
    const view = renderWithStore(<Inspector />, makeBundle(record, TEXT, { entities }));
    act(() => view.store.getState().focusEntity(entity));
    return view;
}

const rows = () => screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-slot-key'));
const rowOf = (key: string) => rows().find((row) => row.getAttribute('data-slot-key') === key)!;
const shapeIn = (row: HTMLElement) => row.querySelector('[data-status-shape]');

describe('Inspector', () => {
    it('shows the focused entity’s class, name and local id', () => {
        setup();
        const card = screen.getByRole('region', { name: 'Patients > Controls' });
        expect(within(card).getByText('Analysis')).toBeInTheDocument();
        expect(within(card).getByText('a_1')).toBeInTheDocument();
    });

    it('names the schema class beside the entity class where they differ', () => {
        setup('acq_1');
        expect(screen.getByText('Acquisition · MRI')).toBeInTheDocument();
    });

    it('shows the record’s local id where it differs from the entity id', () => {
        setup('study');
        const card = screen.getByRole('region', { name: 'Study' });
        expect(within(card).getByText('study-1')).toBeInTheDocument();
        expect(within(card).queryByText('study')).not.toBeInTheDocument();
    });

    it('lists the slots doubtful first, each with a status shape, a visible status label and its value', () => {
        setup();
        expect(
            rows()
                .slice(0, 9)
                .map((row) => row.getAttribute('data-slot-key'))
        ).toEqual([
            'slot:a_1:outcome',
            'slot:a_1:definition',
            'slot:a_1:prespecification',
            'slot:a_1:name',
            'slot:a_1:spatial_scope',
            'slot:a_1:measure',
            'slot:a_1:acquisitions',
            'slot:a_1:groups[#0].group',
            'slot:a_1:groups[#0].n',
        ]);
        const statuses = rows().map((row) => [
            row.getAttribute('data-slot-key'),
            shapeIn(row)?.textContent,
            shapeIn(row)?.getAttribute('data-status-shape'),
        ]);
        expect(statuses.slice(0, 6)).toEqual([
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
        const view = renderWithStore(
            <Inspector />,
            makeBundle({ groups: [{ local_id: 'grp_a', name: ev('Patients'), mystery: ev('x') }] }, TEXT, {
                entities: entityRows(row('grp_a', 'Group', 'groups')),
            })
        );
        act(() => {
            view.store.getState().focusSlot('slot:grp_a:mystery');
            view.store.getState().openPanel('edit');
        });
        expect(screen.getByText('no schema for this slot')).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'edit mystery' })).not.toBeInTheDocument();
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
        const { store } = setup();
        expect(within(rowOf('slot:a_1:measure')).getByRole('button', { name: 'BOLD' })).toBeInTheDocument();
        fireEvent.click(within(rowOf('slot:a_1:groups[#0].group')).getByRole('button', { name: 'Patients' }));
        expect(store.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
        expect(screen.getByRole('region', { name: 'Patients' })).toBeInTheDocument();
    });

    it('focuses a slot when it is clicked', () => {
        const { store } = setup();
        fireEvent.click(within(rows()[3]).getByText('name'));
        expect(store.getState().focus).toEqual({ entity: 'a_1', key: 'slot:a_1:name', slot: 'slot:a_1:name' });
        expect(rows()[3]).toHaveAttribute('aria-current', 'true');
    });

    it('updates a slot’s status when evidence is added, and keeps the row in place while it is focused', () => {
        const { store } = setup();
        act(() => store.getState().focusSlot('slot:a_1:outcome'));
        act(() => void store.getState().addEvidence([10, 20], 'first'));
        expect(rows()[0]).toHaveAttribute('data-slot-key', 'slot:a_1:outcome');
        expect(shapeIn(rows()[0])).toHaveTextContent('evidence present');
        act(() => store.getState().focusSlot('slot:a_1:definition'));
        expect(rows()[0]).toHaveAttribute('data-slot-key', 'slot:a_1:definition');
    });
});
