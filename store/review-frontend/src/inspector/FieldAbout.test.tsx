import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { setSchemas } from '../contract/schemas';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Schema } from '../model/schema';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { GOLDEN_SCHEMAS } from '../test/goldenSchemas';
import { renderWithStores } from '../test/render';
import { Inspector } from './FocusedCard';

const TEXT = 'x'.repeat(200);

const MR_TYPE =
    'Acquisition dimensionality, such as 2D or 3D; useful for distinguishing protocols with materially different spatial sampling.';
const N = 'Number of participants from this cohort included in this analysis.';
const PERCENTAGE = 'Percentage of the relevant group in this category.';
const DEVICE =
    'The scanner, amplifier, or recording system this acquisition was made on, by identifier. Acquisitions made on one machine reference one record; a second record asserts the study used a second machine.';
const DESCRIPTION = 'Narrative definition of the group and its role in the study.';
const GENDER =
    'Aggregate self-described gender distribution, kept separate from phenotypic sex. Use one entry per reported category.';

const record = {
    groups: [
        {
            local_id: 'grp_a',
            name: ev('LTMs'),
            description: ev('Long-term meditators recruited from local centres, all of them right-handed adults.'),
            gender_distribution: [
                {
                    category: ev('Female'),
                    count: ev(15),
                    percentage: ev(53.6),
                    denominator: ev(28),
                    reporting_framework: ev('Gender'),
                },
            ],
        },
    ],
    devices: [{ local_id: 'dev_1', name: ev('Scanner') }],
    acquisitions: [
        {
            local_id: 'acq_1',
            acquisition_type: 'MRI',
            modality: ev('fMRI'),
            pulse_sequence_type: ev('EPI'),
            mr_acquisition_type: ev('3D'),
            device: 'dev_1',
        },
    ],
    analyses: [{ local_id: 'a_1', name: ev('Analysis 1'), groups: [{ group: 'grp_a', n: ev(22) }] }],
};

const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('dev_1', 'Device', 'devices'),
    row('acq_1', 'Acquisition', 'acquisitions', { schema_class: 'MRI' }),
    row('a_1', 'Analysis', 'analyses')
);

const reviewBy = (user_id: string) =>
    ({
        id: 'R1',
        user_id,
        state: 'in_progress',
        last_seq: 0,
        provenance: {},
        annotations: {},
    }) as unknown as ReviewBundle['review'];

function setup(entity: string, viewer?: string) {
    const bundle = makeBundle(record, TEXT, { entities, ...(viewer ? { review: reviewBy(viewer) } : {}) });
    const view = renderWithStores(<Inspector />, bundle);
    act(() => view.stores.view.getState().focusEntity(entity));
    return view;
}

const selected = () => screen.getByRole('region', { name: 'Selected field' });
const aboutLine = () => within(selected()).queryByRole('region', { name: 'About this field' });
const about = () => {
    const line = aboutLine();
    expect(line, 'the About line').toBeInstanceOf(HTMLElement);
    return line!;
};
const valueOf = (key: string) => document.querySelector<HTMLElement>(`[data-slot-key="${key}"] .rv-value-text`)!;

describe('a field’s description', () => {
    it('is the hover hint of a sentence value, after its text, as its label and description', () => {
        setup('acq_1');
        expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute(
            'title',
            expect.stringMatching(new RegExp(`^3D — .+: ${MR_TYPE.replace(/[.()]/g, '\\$&')}$`))
        );
    });

    it('is the hover hint of a piece of a row’s line, after the piece’s text', () => {
        setup('grp_a');
        const line = screen.getByRole('group', { name: 'Gender' });
        expect(within(line).getByRole('button', { name: '53.6' })).toHaveAttribute(
            'title',
            expect.stringMatching(new RegExp(`^53\\.6 — .+: ${PERCENTAGE.replace(/[.()]/g, '\\$&')}$`))
        );
    });

    it('shows collapsed under the selected field’s details, its first sentence and More', () => {
        setup('acq_1');
        fireEvent.click(screen.getByRole('button', { name: '3D' }));
        const line = about();
        expect(line).toHaveTextContent(/^Acquisition dimensionality, such as 2D or 3D/);
        expect(within(line).getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('expands on More to its full text, which Less collapses', () => {
        setup('acq_1');
        fireEvent.click(screen.getByRole('button', { name: '3D' }));
        fireEvent.click(within(about()).getByRole('button', { name: 'More' }));
        expect(about()).toHaveTextContent(MR_TYPE);
        expect(within(about()).getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(within(about()).getByRole('button', { name: 'Less' }));
        expect(within(about()).getByRole('button', { name: 'More' })).toBeInTheDocument();
    });

    it('stays open for the viewer, on every field and the next time the review opens, but not for another viewer', () => {
        setup('acq_1', 'ana');
        fireEvent.click(screen.getByRole('button', { name: '3D' }));
        fireEvent.click(within(about()).getByRole('button', { name: 'More' }));
        cleanup();

        setup('a_1', 'ana');
        fireEvent.click(screen.getByRole('button', { name: '22' }));
        expect(within(about()).getByRole('button', { name: 'Less' })).toBeInTheDocument();
        cleanup();

        setup('a_1', 'ben');
        fireEvent.click(screen.getByRole('button', { name: '22' }));
        expect(within(about()).getByRole('button', { name: 'More' })).toBeInTheDocument();
    });

    it.each([
        ['an analysis’s group n', 'a_1', '22', N],
        ['a distribution’s percentage', 'grp_a', '53.6', PERCENTAGE],
    ])('of a nested field, %s, is its own leaf’s', (_, entity, value, description) => {
        setup(entity);
        fireEvent.click(screen.getByRole('button', { name: value }));
        fireEvent.click(within(about()).getByRole('button', { name: 'More' }));
        expect(about()).toHaveTextContent(description);
        expect(screen.getByRole('button', { name: value })).toHaveAttribute(
            'title',
            expect.stringContaining(`: ${description}`)
        );
    });

    it('reaches a keyboard user on the focused value', () => {
        setup('acq_1');
        expect(screen.getByRole('button', { name: '3D' })).not.toHaveAttribute('aria-describedby');
        fireEvent.click(screen.getByRole('button', { name: '3D' }));
        expect(screen.getByRole('button', { name: '3D' })).toHaveAccessibleDescription(
            expect.stringContaining(MR_TYPE)
        );
    });

    it('is the hint of a row’s label, a link group’s label and the details head', () => {
        setup('grp_a');
        const label = document.querySelector('[data-slot-key="slot:grp_a:description"] .rv-row-label');
        expect(label).toHaveAttribute('title', DESCRIPTION);
        const gender = screen.getByRole('group', { name: 'Gender' });
        expect(within(gender).getByText('Gender')).toHaveAttribute('title', GENDER);
        fireEvent.click(valueOf('slot:grp_a:description'));
        expect(within(selected()).getByText(/^Selected ·/)).toHaveAttribute('title', DESCRIPTION);
        cleanup();

        setup('acq_1');
        const devices = screen.getByRole('group', { name: 'device' });
        expect(within(devices).getByText('device')).toHaveAttribute('title', DEVICE);
    });

    it('of a field the schema leaves undescribed shows no About line and no hint', () => {
        const schema = structuredClone(GOLDEN_SCHEMAS['extraction-record']) as Schema & {
            $defs: { MRI: { properties: { mr_acquisition_type: { description?: string } } } };
        };
        delete schema.$defs.MRI.properties.mr_acquisition_type.description;
        setSchemas({ ...GOLDEN_SCHEMAS, 'extraction-record': schema });
        setup('acq_1');
        fireEvent.click(screen.getByRole('button', { name: '3D' }));
        expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute('title', '3D');
        expect(screen.getByRole('button', { name: '3D' })).not.toHaveAttribute('aria-describedby');
        expect(screen.getByRole('button', { name: '3D' })).not.toHaveAccessibleDescription(
            expect.stringContaining(':')
        );
        expect(aboutLine()).toBeNull();
        expect(within(selected()).getByText(/^Selected ·/)).not.toHaveAttribute('title');
    });
});
