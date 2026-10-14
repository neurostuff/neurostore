import { act, fireEvent, screen } from '@testing-library/react';
import { ReviewScreen } from '../review/ReviewScreen';
import { registeredSpans } from '../test/highlights';
import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import { renderWithStore } from '../test/render';
import { validateOpBatch } from '../test/schemas';
import { TextIndex } from './TextIndex';

const TEXT = 'We scanned twenty patients and twenty controls on a 3 T scanner.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const record = {
    groups: [{ local_id: 'grp_a', name: ev('Patients', [at('patients')]), species: notReported('outside_text') }],
};

function setup() {
    const view = renderWithStore(
        <ReviewScreen />,
        makeBundle(record, TEXT, { entities: entityRows(row('grp_a', 'Group', 'groups')) })
    );
    act(() => view.store.getState().focusSlot('slot:grp_a:name'));
    const select = (start: number, end: number) =>
        act(() => {
            const selection = window.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(TextIndex.build(view.textRoot()).toRange(start, end));
            document.dispatchEvent(new Event('selectionchange'));
        });
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
        act(() => window.getSelection()!.removeAllRanges());
        act(() => void document.dispatchEvent(new Event('selectionchange')));
        expect(bar()).not.toBeInTheDocument();
    });

    it('E adds the selection, snapped to words, to the focused slot’s first evidence set', () => {
        const { store, select, textRoot } = setup();
        select(TEXT.indexOf('ontrol'), TEXT.indexOf('ontrol') + 3);
        press('e');
        const { pending } = store.getState();
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

    it('Shift+E adds the selection as a new evidence set', () => {
        const { store, select } = setup();
        select(TEXT.indexOf('scanner'), TEXT.indexOf('scanner') + 7);
        press('E', true);
        expect(store.getState().pending[0]).toMatchObject({
            evidence: {
                sets: [
                    { spans: [{ start_char: at('patients')[0] }] },
                    { spans: [{ start_char: at('scanner')[0], end_char: at('scanner')[1] }] },
                ],
            },
        });
    });

    it('the bar’s buttons do what E and Shift+E do', () => {
        const { store, select } = setup();
        select(TEXT.indexOf('twenty'), TEXT.indexOf('twenty') + 2);
        fireEvent.click(screen.getByRole('button', { name: /add to evidence/i }));
        expect(store.getState().pending).toHaveLength(1);
        select(TEXT.indexOf('3 T'), TEXT.indexOf('3 T') + 3);
        fireEvent.click(screen.getByRole('button', { name: /new evidence set/i }));
        expect(store.getState().pending[1]).toMatchObject({
            evidence: { sets: [{}, { spans: [{ start_char: at('3 T')[0] }] }] },
        });
    });

    it('on a slot that is not extracted, disables both actions and says to set a value first', () => {
        const { store, select } = setup();
        act(() => store.getState().focusSlot('slot:grp_a:species'));
        select(TEXT.indexOf('scanner'), TEXT.indexOf('scanner') + 7);
        expect(screen.getByRole('button', { name: /add to evidence/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /new evidence set/i })).toBeDisabled();
        expect(bar()).toHaveTextContent('set a value first');
        press('e');
        press('E', true);
        expect(store.getState().pending).toEqual([]);
        act(() => store.getState().focusSlot('slot:grp_a:name'));
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
