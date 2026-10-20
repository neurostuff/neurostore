import { ThemeProvider } from '@mui/material';
import { decomposeColor, getContrastRatio, hexToRgb } from '@mui/material/styles';
import { act, fireEvent, screen, within } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { ReviewScreen } from '../review/ReviewScreen';
import { SHORTCUTS } from '../review/shortcuts';
import { STEPS } from '../model/steps';
import { at, comparisonBundle } from '../test/comparisons';
import { registeredSpans } from '../test/highlights';
import { renderWithStores } from '../test/render';
import { makeTheme } from '../theme';

const review = {
    id: 'r1',
    user_id: 'u1',
    state: 'in_progress',
    last_seq: 0,
    provenance: {},
    annotations: {},
} as const;

function setup(analysis: string, mode?: 'light' | 'dark') {
    const ui = mode ? (
        <ThemeProvider theme={makeTheme(mode)}>
            <ReviewScreen />
        </ThemeProvider>
    ) : (
        <ReviewScreen />
    );
    const view = renderWithStores(ui, comparisonBundle({ review: { ...review } }));
    act(() => view.stores.view.getState().setStep('analyses'));
    act(() => view.stores.view.getState().focusEntity(analysis));
    const viewState = () => view.stores.view.getState();
    const pending = () => view.stores.session.getState().pending;
    return { ...view, viewState, pending };
}

const compared = () => screen.getByRole('region', { name: 'What is compared' });
const headline = () => within(compared()).getByRole('heading');
const term = (name: string) => within(compared()).getByRole('group', { name });
const chips = (name: string) =>
    within(term(name))
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label'));
const press = (key: string, target: Element = document.body) => act(() => void fireEvent.keyDown(target, { key }));
const chip = (termName: string, name: RegExp) => within(term(termName)).getByRole('button', { name });
const verdicts = (ops: Op[]) =>
    ops.flatMap((op) => (op.type === 'verdict' && op.target.kind === 'slot' ? [op.target.path] : []));
const DIRECTION = (analysis: string, cell: number) => `slot:${analysis}:effect.cells[#${cell}].direction`;

describe('an analysis card shows what is compared', () => {
    it('in its own section under the card head and above the fields', () => {
        setup('a_held');
        const fields = screen.getByRole('region', { name: /^Fields of Pos versus Neg/ });
        const head = within(fields).getByRole('group', { name: /: card head$/ });
        const section = within(fields).getByRole('region', { name: 'What is compared' });
        const firstField = within(fields).getByRole('region', { name: 'About' });
        expect(head.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(section.compareDocumentPosition(firstField) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(firstField.querySelector('[data-slot-key]')).not.toBeNull();
    });

    it('a contrast within held levels: the headline, then a row per term', () => {
        setup('a_held');
        expect(headline()).toHaveTextContent('Pos > Neg within On, at Low');
        expect(chips('status')).toEqual(['+ Pos, unchecked', '− Neg, unchecked']);
        expect(chips('drug')).toEqual(['held at On, unchecked']);
        expect(chips('choice')).toEqual(['held at Low, unchecked']);
        expect(within(term('status')).getByText('+ Pos')).toBeInTheDocument();
        expect(within(term('drug')).getByText('held at On')).toBeInTheDocument();
    });

    it('an interaction: each factor’s sides, and the held term', () => {
        setup('a_inter');
        expect(headline()).toHaveTextContent('(G1 − G2) × (Wide − Narrow)');
        expect(chips('group')).toEqual(['+ G1, unchecked', '− G2, unchecked']);
        expect(chips('angle')).toEqual(['+ Wide, unchecked', '− Narrow, unchecked']);
        expect(chips('inversion')).toEqual(['held at Same, unchecked']);
    });

    it('a side with several levels: how many, then each by name', () => {
        setup('a_multi');
        expect(headline()).toHaveTextContent('CueA and CueB > CueC');
        expect(within(term('cue')).getByText('+ 2 levels')).toBeInTheDocument();
        expect(chips('cue')).toEqual(['+ CueA, unchecked', '+ CueB, unchecked', '− CueC, unchecked']);
    });

    it('an omnibus: every term’s levels, either way', () => {
        setup('a_omni');
        expect(headline()).toHaveTextContent('any difference among status × drug × choice');
        expect(chips('choice')).toEqual([
            'Low either way, unchecked',
            'Mid either way, unchecked',
            'High either way, unchecked',
        ]);
        expect(within(term('choice')).getByText('either way')).toBeInTheDocument();
    });

    it('a regression with no signs: each term’s sign missing, and counted', () => {
        setup('a_reg');
        expect(headline()).toHaveTextContent('brain measure ~ 4 terms');
        expect(chips('score A')).toEqual(['score A, sign missing, unchecked']);
        expect(within(compared()).getAllByText('sign missing')).toHaveLength(4);
        expect(within(compared()).getByText('4 signs missing')).toBeInTheDocument();
    });

    it('a continuous term’s way: greater or less with more', () => {
        setup('a_mod');
        expect(chips('score A')).toEqual(['score A ↑ greater with more, unchecked']);
        expect(chips('score B')).toEqual(['score B ↓ less with more, unchecked']);
    });

    it('an entity that is not an analysis keeps its card as it was', () => {
        const { viewState } = setup('a_held');
        act(() => viewState().setStep('entities'));
        act(() => viewState().focusEntity('grp_a'));
        expect(screen.queryByRole('region', { name: 'What is compared' })).not.toBeInTheDocument();
    });
});

describe('a chip of the comparison', () => {
    it('focuses its cell’s direction on a click, and the text highlights its evidence', () => {
        const { viewState, textRoot } = setup('a_inter');
        const chip = within(term('group')).getByRole('button', { name: '− G2, unchecked' });
        fireEvent.click(chip);
        expect(viewState().focus.slot).toBe(DIRECTION('a_inter', 1));
        expect(chip).toHaveAttribute('aria-current', 'true');
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('first group')]);
    });

    it('takes the field actions: a accepts its direction, and the chip says so', () => {
        const { pending } = setup('a_held');
        fireEvent.click(within(term('status')).getByRole('button', { name: '+ Pos, unchecked' }));
        expect(within(compared()).getByRole('toolbar', { name: /^actions on / })).toBeInTheDocument();
        press('a');
        expect(pending().at(-1)).toMatchObject({
            type: 'verdict',
            verdict: 'accept',
            target: { kind: 'slot', entity: 'a_held', path: 'effect.cells[#0].direction' },
        });
        expect(chips('status')).toEqual(['+ Pos, verified', '− Neg, unchecked']);
    });

    it('edits its sign as +, −, held or either way, sending one set_value', () => {
        const { pending } = setup('a_inter');
        fireEvent.click(within(term('group')).getByRole('button', { name: '− G2, unchecked' }));
        fireEvent.click(within(compared()).getByRole('button', { name: 'Edit' }));
        const sign = within(compared()).getByRole('combobox', { name: /direction/ });
        expect(
            within(sign)
                .getAllByRole('option')
                .map((o) => o.textContent)
        ).toEqual(['+ greater', '− less', 'either way', 'held']);
        fireEvent.change(sign, { target: { value: 'positive' } });
        fireEvent.click(within(compared()).getByRole('button', { name: 'Save' }));
        expect(pending().at(-1)).toMatchObject({
            type: 'set_value',
            target: { kind: 'slot', entity: 'a_inter', path: 'effect.cells[#1].direction' },
            value: { extraction_status: 'extracted', value: 'positive' },
        });
    });
});

describe('the cells’ slots', () => {
    it('are not listed again among the fields', () => {
        setup('a_held');
        const fields = screen.getByRole('region', { name: /^Fields of Pos versus Neg/ });
        const section = within(fields).getByRole('region', { name: 'What is compared' });
        const listed = [...fields.querySelectorAll('[data-slot-key]')]
            .filter((field) => !section.contains(field))
            .map((field) => field.getAttribute('data-slot-key'));
        expect(listed.filter((key) => key?.includes('effect.cells'))).toEqual([]);
        expect(listed).toContain('slot:a_held:effect.statistic.family');
    });

    it('are still accepted with the analysis', () => {
        const { pending } = setup('a_held');
        fireEvent.click(screen.getByRole('button', { name: 'Accept analysis' }));
        fireEvent.click(screen.getByRole('button', { name: 'Accept all fields' }));
        const accepted = pending().flatMap((op) =>
            op.type === 'verdict' && op.target.kind === 'slot' ? [op.target.path] : []
        );
        expect(accepted).toEqual(
            expect.arrayContaining(['effect.cells[#0].direction', 'effect.cells[#2].direction', 'effect.kind'])
        );
    });
});

describe('j and k on an analysis', () => {
    it('move through the comparison’s chips, then on into the fields', () => {
        const { viewState } = setup('a_held');
        const slots: (string | undefined)[] = [];
        for (let i = 0; i < 6; i++) {
            press('j');
            slots.push(viewState().focus.slot);
        }
        expect(slots).toEqual([
            'slot:a_held:name',
            DIRECTION('a_held', 0),
            DIRECTION('a_held', 1),
            DIRECTION('a_held', 2),
            DIRECTION('a_held', 3),
            'slot:a_held:effect.kind',
        ]);
        press('k');
        expect(viewState().focus.slot).toBe(DIRECTION('a_held', 3));
    });

    it('are told in the help sheet and the step’s hint', () => {
        const j = SHORTCUTS.find((s) => s.scope === 'record' && s.keys.includes('j'))!;
        expect(j.label).toMatch(/comparison/);
        expect(STEPS.find((s) => s.id === 'analyses')!.hint).toMatch(/what is compared/i);
    });
});

describe.each(['light', 'dark'] as const)('the sign colours, %s', (mode) => {
    it('read at 4.5:1 or more on their chips and on the field surface', () => {
        const { palette } = makeTheme(mode);
        const signs = Object.entries(palette.sign ?? {});
        expect(signs.map(([name]) => name)).toEqual(['greater', 'less', 'missing']);
        const low = signs.filter(
            ([, { text, surface }]) =>
                getContrastRatio(text, surface) < 4.5 || getContrastRatio(text, palette.fieldSurface) < 4.5
        );
        expect(low.map(([name]) => name)).toEqual([]);
    });
});

describe('a focused chip', () => {
    it('shows its field’s whole head: its notes, and who edited it', () => {
        const { stores } = setup('a_held');
        const key = DIRECTION('a_held', 0);
        act(() =>
            stores.session.setState({
                bundle: {
                    ...stores.session.getState().bundle,
                    reviewers: [{ user_id: 'u1', name: 'Ana', state: 'in_progress', op_count: 0, last_edit_at: null }],
                },
                provenance: { [key]: { state: 'edited', user_id: 'u1', at: 'then' } },
                pending: [
                    {
                        client_op_id: 'n1',
                        type: 'note',
                        target: { kind: 'slot', entity: 'a_held', path: 'effect.cells[#0].direction' },
                        note: 'the sign is reversed',
                    },
                ],
            })
        );
        fireEvent.click(chip('status', /^\+ Pos,/));
        expect(within(compared()).getByText('edited by Ana')).toBeInTheDocument();
        expect(within(compared()).getByRole('img', { name: 'noted: the sign is reversed' })).toBeInTheDocument();
    });

    it('reads edited after its sign is edited, and rejected after r with a reason', () => {
        setup('a_inter');
        fireEvent.click(chip('group', /^− G2,/));
        fireEvent.click(within(compared()).getByRole('button', { name: 'Edit' }));
        fireEvent.change(within(compared()).getByRole('combobox', { name: /direction/ }), {
            target: { value: 'positive' },
        });
        fireEvent.click(within(compared()).getByRole('button', { name: 'Save' }));
        expect(chip('group', /^\+ G2,/)).toHaveAccessibleName('+ G2, edited');
        fireEvent.click(chip('angle', /^− Narrow,/));
        press('r');
        const panel = within(compared()).getByRole('group', { name: /^reject / });
        press('1', within(panel).getAllByRole('radio')[0]);
        press('Enter', within(panel).getByRole('textbox', { name: 'note' }));
        expect(chip('angle', /^− Narrow,/)).toHaveAccessibleName('− Narrow, rejected');
    });

    it.each([
        ['either way', 'undirected'],
        ['held', 'held'],
        ['+ greater', 'positive'],
        ['− less', 'negative'],
    ])('missing its sign, is given one: %s sends %s', (words, value) => {
        const { pending } = setup('a_unsigned');
        fireEvent.click(chip('status', /^Neg, sign missing/));
        fireEvent.click(within(compared()).getByRole('button', { name: 'Edit' }));
        fireEvent.change(within(compared()).getByRole('combobox', { name: 'In the paper?' }), {
            target: { value: 'extracted' },
        });
        const sign = within(compared()).getByRole('combobox', { name: /direction/ });
        const option = within(sign)
            .getAllByRole<HTMLOptionElement>('option')
            .find((o) => o.textContent === words)!;
        fireEvent.change(sign, { target: { value: option.value } });
        fireEvent.click(within(compared()).getByRole('button', { name: 'Save' }));
        expect(pending().at(-1)).toMatchObject({
            type: 'set_value',
            target: { path: 'effect.cells[#1].direction' },
            value: { extraction_status: 'extracted', value },
        });
    });
});

describe('a term’s chips, whatever the order of its cells in the record', () => {
    it('read greater, less, then held, and j follows them', () => {
        const { viewState } = setup('a_mixed');
        expect(chips('status')).toEqual(['+ Pos, unchecked', '− Neg, unchecked']);
        const order = [...compared().querySelectorAll('button[data-slot-key]')].map((b) =>
            b.getAttribute('data-slot-key')
        );
        expect(order).toEqual([DIRECTION('a_mixed', 2), DIRECTION('a_mixed', 0), DIRECTION('a_mixed', 1)]);
        const stepped = [0, 1, 2, 3].map(() => {
            press('j');
            return viewState().focus.slot;
        });
        expect(stepped).toEqual(['slot:a_mixed:name', ...order]);
    });

    it('show a continuous term going either way', () => {
        setup('a_either');
        expect(chips('score C')).toEqual(['score C either way, unchecked']);
        expect(chips('untyped score')).toEqual(['untyped score ↑ greater with more, unchecked']);
    });
});

describe('accepting an analysis with its cells', () => {
    const accept = (choice: string) => {
        const view = setup('a_held');
        fireEvent.click(screen.getByRole('button', { name: 'Accept analysis' }));
        fireEvent.click(screen.getByRole('button', { name: choice }));
        return view;
    };
    const summary = () => screen.getByText(/^Accepted the analysis/);

    it('with evidence only: counts the cells’ fields with evidence, and leaves the rest unchecked', () => {
        const { pending } = accept('Accept fields with evidence');
        expect(summary()).toHaveTextContent('Accepted the analysis and 4 fields');
        const accepted = verdicts(pending());
        expect(accepted).toEqual(
            expect.arrayContaining([
                'effect.cells[#0].direction',
                'effect.cells[#0].level',
                'effect.cells[#1].direction',
                'effect.cells[#1].level',
            ])
        );
        expect(accepted).not.toContain('effect.cells[#2].direction');
        expect(accepted).not.toContain('effect.cells[#2].level');
        expect(accepted.filter((path) => path?.endsWith('.term'))).toEqual([]);
        expect(chips('status')).toEqual(['+ Pos, verified', '− Neg, verified']);
        expect(chips('drug')).toEqual(['held at On, unchecked']);
    });

    it('all fields: counts every cell’s level and direction too', () => {
        const { pending } = accept('Accept all fields');
        const cellFields = verdicts(pending()).filter((path) => path?.startsWith('effect.cells'));
        expect(cellFields).toHaveLength(8);
        expect(summary()).toHaveTextContent(`Accepted the analysis and ${verdicts(pending()).length} fields`);
    });
});

describe('an analysis card outside the Analyses step', () => {
    it('shows what is compared too', () => {
        const { viewState } = setup('a_held');
        act(() => viewState().setStep('entities'));
        act(() => viewState().focusEntity('a_inter'));
        expect(screen.getByText('outside this step')).toBeInTheDocument();
        expect(headline()).toHaveTextContent('(G1 − G2) × (Wide − Narrow)');
    });
});

describe.each(['light', 'dark'] as const)('the chips’ colours, %s', (mode) => {
    it('are the theme’s greater colours for +, and its less colours for −', () => {
        setup('a_inter', mode);
        const { sign } = makeTheme(mode).palette;
        const plus = getComputedStyle(chip('group', /^\+ G1,/));
        const minus = getComputedStyle(chip('group', /^− G2,/));
        expect([plus.color, plus.backgroundColor]).toEqual([
            hexToRgb(sign.greater.text),
            hexToRgb(sign.greater.surface),
        ]);
        expect([minus.color, minus.backgroundColor]).toEqual([hexToRgb(sign.less.text), hexToRgb(sign.less.surface)]);
        const [red, , blue] = decomposeColor(sign.greater.text).values;
        const [lessRed, , lessBlue] = decomposeColor(sign.less.text).values;
        expect(blue, 'greater is blue').toBeGreaterThan(red);
        expect(lessRed, 'less is orange').toBeGreaterThan(lessBlue);
    });
});
