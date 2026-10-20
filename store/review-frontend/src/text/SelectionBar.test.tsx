import { act, fireEvent, screen, within } from '@testing-library/react';
import { ReviewScreen } from '../review/ReviewScreen';
import { registeredSpans } from '../test/highlights';
import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { validateOpBatch } from '../test/schemas';
import type { SetEvidenceOp } from '../contract/generated/review-ops';
import { addSelectionTo } from './addSelection';
import { selectText, clearSelection } from '../test/selection';

const TEXT = 'We scanned twenty patients and twenty controls on a 3 T scanner.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const spansOf = (...words: string[]) => words.map((word) => ({ start_char: at(word)[0], end_char: at(word)[1] }));

const record = {
    groups: [
        {
            local_id: 'grp_a',
            name: ev('Patients', [at('patients')]),
            species: notReported('outside_text'),
            sex: { extraction_status: 'extracted', value: 'mixed', value_source: 'reported' },
            age_mean: ev(30),
        },
    ],
};

const inTwoSets = (value: unknown) => ({
    ...ev(value),
    evidence: { status: 'present', sets: [{ spans: spansOf('patients') }, { spans: spansOf('controls') }] },
});

const twoSets = {
    groups: [{ local_id: 'grp_a', name: inTwoSets('Patients'), age_mean: inTwoSets(30) }],
};

function setup(given: typeof record | typeof twoSets = record) {
    const view = renderWithStores(
        <ReviewScreen />,
        makeBundle(given, TEXT, { entities: entityRows(row('grp_a', 'Group', 'groups')) })
    );
    act(() => view.stores.view.getState().focusSlot('slot:grp_a:name'));
    const select = (start: number, end: number) => selectText(view.textRoot(), [start, end]);
    return { ...view, select };
}

const press = (key: string, shiftKey = false) => act(() => void fireEvent.keyDown(document.body, { key, shiftKey }));
const bar = () => screen.queryByRole('toolbar', { name: 'selection' });

describe('adding evidence from a text selection', () => {
    it('shows a bar at a selection in the text', () => {
        const { select } = setup();
        expect(bar()).not.toBeInTheDocument();
        select(TEXT.indexOf('ontrol'), TEXT.indexOf('ontrol') + 3);
        expect(bar()).toBeInTheDocument();
        clearSelection();
        expect(bar()).not.toBeInTheDocument();
    });

    it('E adds the selection, snapped to words, to the focused slot’s first evidence set', () => {
        const { stores, select, textRoot } = setup();
        select(TEXT.indexOf('ontrol'), TEXT.indexOf('ontrol') + 3);
        press('e');
        const { pending } = stores.session.getState();
        expect(validateOpBatch({ ops: pending })).toBe(true);
        expect(pending).toEqual([
            {
                client_op_id: expect.any(String),
                type: 'set_evidence',
                target: { kind: 'slot', entity: 'grp_a', path: 'name' },
                evidence: {
                    status: 'present',
                    sets: [
                        {
                            spans: [
                                { start_char: at('patients')[0], end_char: at('patients')[1] },
                                { start_char: at('controls')[0], end_char: at('controls')[1] },
                            ],
                        },
                    ],
                },
            },
        ]);
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('patients'), at('controls')]);
        expect(bar()).not.toBeInTheDocument();
    });

    it('Shift+E does nothing', () => {
        const { stores, select } = setup();
        select(TEXT.indexOf('scanner'), TEXT.indexOf('scanner') + 7);
        press('E', true);
        expect(stores.session.getState().pending).toEqual([]);
        expect(bar()).toBeInTheDocument();
    });

    it('E adds to the set holding the span the evidence cursor is on', () => {
        const { stores, select } = setup(twoSets);
        act(() => stores.view.getState().stepEvidence(1));
        select(TEXT.indexOf('scanner'), TEXT.indexOf('scanner') + 7);
        press('e');
        expect(stores.session.getState().pending[0]).toMatchObject({
            evidence: {
                sets: [
                    { spans: [{ start_char: at('patients')[0] }] },
                    {
                        spans: [
                            { start_char: at('controls')[0], end_char: at('controls')[1] },
                            { start_char: at('scanner')[0], end_char: at('scanner')[1] },
                        ],
                    },
                ],
            },
        });
    });

    it('E on a field with no evidence makes its one set of the selection', () => {
        const { stores, select } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:sex'));
        select(TEXT.indexOf('scanner'), TEXT.indexOf('scanner') + 7);
        press('e');
        expect(stores.session.getState().pending[0]).toMatchObject({
            evidence: {
                status: 'present',
                sets: [{ spans: [{ start_char: at('scanner')[0], end_char: at('scanner')[1] }] }],
            },
        });
    });

    it.each([
        ['evidence not found', 'slot:grp_a:age_mean'],
        ['no evidence', 'slot:grp_a:sex'],
    ])('labels a field with %s as evidence present once a selection is added to it', (_, key) => {
        const { stores, select } = setup();
        act(() => stores.view.getState().focusSlot(key));
        const status = () => document.querySelector(`[data-slot-key="${key}"] [data-status]`);
        expect(status()).toHaveAttribute('data-status', 'not_found');
        select(TEXT.indexOf('scanner'), TEXT.indexOf('scanner') + 7);
        press('e');
        expect(status()).toHaveAttribute('data-status', 'present');
        expect(status()).toHaveAccessibleName('evidence present');
    });

    it('adds to the first set of a field the evidence cursor is not on, though another field’s cursor span is in its second', () => {
        const { stores, select } = setup(twoSets);
        act(() => stores.view.getState().stepEvidence(1));
        select(TEXT.indexOf('scanner'), TEXT.indexOf('scanner') + 7);
        act(() => void addSelectionTo(stores, 'slot:grp_a:age_mean'));
        expect(stores.session.getState().pending[0]).toMatchObject({
            target: { path: 'age_mean' },
            evidence: {
                sets: [{ spans: spansOf('patients', 'scanner') }, { spans: spansOf('controls') }],
            },
        });
    });

    it('adds to the first of several sets while the cursor is on it, making no new set', () => {
        const { stores, select } = setup(twoSets);
        select(TEXT.indexOf('scanner'), TEXT.indexOf('scanner') + 7);
        press('e');
        expect(stores.session.getState().pending[0]).toMatchObject({
            evidence: { sets: [{ spans: spansOf('patients', 'scanner') }, { spans: spansOf('controls') }] },
        });
        expect((stores.session.getState().pending[0] as SetEvidenceOp).evidence.sets).toHaveLength(2);
    });

    it('highlights every span of a field with two sets, and ] and [ step through them', () => {
        const { textRoot } = setup(twoSets);
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('patients'), at('controls')]);
        expect(screen.getByText('evidence 1 of 2')).toBeInTheDocument();
        press(']');
        expect(screen.getByText('evidence 2 of 2')).toBeInTheDocument();
        press('[');
        expect(screen.getByText('evidence 1 of 2')).toBeInTheDocument();
    });

    it('names no evidence set in the help or the field’s actions', () => {
        setup(twoSets);
        const field = screen.getByRole('toolbar', { name: /^actions on / });
        press('?', true);
        const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
        const texts = [...help.querySelectorAll('td'), ...field.querySelectorAll('button')].map((e) => e.textContent!);
        expect(texts.length).toBeGreaterThan(10);
        for (const text of texts) expect(text.replace(/set aside|set a value/gi, '')).not.toMatch(/\bsets?\b/i);
    });

    it('offers one action, adding to the field it names', () => {
        const { select } = setup();
        select(TEXT.indexOf('twenty'), TEXT.indexOf('twenty') + 6);
        expect(
            within(bar()!)
                .getAllByRole('button')
                .map((button) => button.textContent)
        ).toEqual(['Add as evidence for Patients · Name (E)']);
        expect(bar()).not.toHaveTextContent(/\bset\b/i);
    });

    it('the bar’s button does what E does', () => {
        const { stores, select } = setup();
        select(TEXT.indexOf('twenty'), TEXT.indexOf('twenty') + 2);
        fireEvent.click(screen.getByRole('button', { name: /add as evidence/i }));
        expect(stores.session.getState().pending[0]).toMatchObject({
            evidence: { sets: [{ spans: [{ start_char: at('twenty')[0] }, { start_char: at('patients')[0] }] }] },
        });
    });

    it('on a slot that is not extracted, disables the action and says to set a value first', () => {
        const { stores, select } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:species'));
        select(TEXT.indexOf('scanner'), TEXT.indexOf('scanner') + 7);
        expect(screen.getByRole('button', { name: /add as evidence/i })).toBeDisabled();
        expect(bar()).toHaveTextContent('set a value first');
        press('e');
        expect(stores.session.getState().pending).toEqual([]);
        act(() => stores.view.getState().focusSlot('slot:grp_a:name'));
        expect(bar()).not.toHaveTextContent('set a value first');
    });

    it('sits just below the selection’s left edge, in the scroller’s coordinates', () => {
        const { select, container } = setup();
        const scroller = container.querySelector<HTMLElement>('[data-text-scroller]')!;
        scroller.scrollTop = 50;
        vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({ top: 100, left: 10 } as DOMRect);
        vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue({ bottom: 130, left: 45 } as DOMRect);
        select(TEXT.indexOf('scanner'), TEXT.indexOf('scanner') + 7);
        expect(bar()).toHaveStyle({ top: '84px', left: '35px' });
    });
});

describe('the selection bar in a read-only tab', () => {
    it('disables adding evidence, and E adds none', () => {
        const { stores, select } = setup();
        act(() => stores.session.getState().setDevice('readonly'));
        select(TEXT.indexOf('ontrol'), TEXT.indexOf('ontrol') + 3);
        expect(screen.getByRole('button', { name: 'Add as evidence for Patients · Name (E)' })).toBeDisabled();
        press('e');
        expect(stores.session.getState().pending).toEqual([]);
    });
});
