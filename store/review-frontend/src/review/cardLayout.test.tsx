import { getContrastRatio } from '@mui/material/styles';
import { act, screen, within } from '@testing-library/react';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { makeTheme } from '../theme';
import { STATUSES } from '../inspector/status';
import { ReviewScreen } from './ReviewScreen';

const TEXT = 'Twenty patients and twenty controls performed a Stroop task during a 3 T fMRI scan.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const bundle = makeBundle(
    {
        analyses: [
            {
                local_id: 'a_1',
                name: ev('Patients > Controls', [at('patients')]),
                statistic: ev('t', [at('Stroop')]),
                groups: [{ group: 'grp_a', n: ev(20, [at('Twenty')]) }],
            },
            { local_id: 'a_2', name: ev('Controls > Patients', [at('controls')]) },
        ],
        groups: [
            { local_id: 'grp_a', name: ev('Patients', [at('patients')]) },
            { local_id: 'grp_b', name: ev('Siblings') },
        ],
    },
    TEXT,
    {
        entities: entityRows(
            row('a_1', 'Analysis', 'analyses'),
            row('a_2', 'Analysis', 'analyses'),
            row('grp_a', 'Group', 'groups'),
            row('grp_b', 'Group', 'groups')
        ),
    }
);

function setup() {
    const view = renderWithStores(<ReviewScreen />, bundle);
    act(() => view.stores.view.getState().setStep('analyses'));
    return view;
}

const cards = () => within(screen.getByRole('list', { name: 'analyses' })).getAllByRole('listitem');

describe('the cards of a step and the fields of the selected one', () => {
    it('nests the selected card’s fields in a region of their own, inside its card', () => {
        setup();
        const [first, second] = cards().filter(
            (li) => li.parentElement === screen.getByRole('list', { name: 'analyses' })
        );
        const fields = within(first).getByRole('region', { name: 'Fields of Patients > Controls' });
        expect(fields.querySelector('[data-slot-key="slot:a_1:statistic"]')).not.toBeNull();
        expect(within(second).queryByRole('region', { name: /^Fields of / })).not.toBeInTheDocument();
    });

    it.each([
        ['entities', 'Patients'],
        ['leftovers', 'Siblings'],
    ] as const)('nests the fields in the %s step too', (step, name) => {
        const { stores } = setup();
        act(() => stores.view.getState().setStep(step));
        const fields = within(screen.getByRole('list', { name: step })).getByRole('region', {
            name: `Fields of ${name}`,
        });
        expect(within(fields).getByRole('group', { name: `${name}: card head` })).toBeInTheDocument();
    });

    it('keeps the card head, its name, status and actions, stuck at the top while its fields scroll', () => {
        setup();
        const fields = screen.getByRole('region', { name: 'Fields of Patients > Controls' });
        const head = within(fields).getByRole('group', { name: 'Patients > Controls: card head' });
        expect(getComputedStyle(head).position).toBe('sticky');
        expect(getComputedStyle(head).top).toBe('0px');
        expect(within(head).getByText('unchecked')).toBeInTheDocument();
        expect(within(head).getByRole('button', { name: 'Accept analysis' })).toBeInTheDocument();
    });

    describe.each(['light', 'dark'] as const)('the field panel’s surface, %s', (mode) => {
        const t = makeTheme(mode);
        const surface = t.palette.fieldSurface;

        it('is its own, and the text reads on it', () => {
            expect(surface).not.toBe(t.palette.background.paper);
            expect(getContrastRatio(t.palette.text.primary, surface)).toBeGreaterThanOrEqual(4.5);
            expect(getContrastRatio(t.palette.text.secondary, surface)).toBeGreaterThanOrEqual(4.5);
        });

        it('shows every status colour and the primary overline at 3:1 or more', () => {
            const colours = [
                ...Object.entries(STATUSES).map(([id, status]) => [id, status.color(t.palette)] as const),
                ['overline', t.palette.primary.main] as const,
            ];
            expect(colours.filter(([, colour]) => getContrastRatio(colour, surface) < 3).map(([id]) => id)).toEqual([]);
        });
    });
});
