import { act, fireEvent, screen } from '@testing-library/react';
import { registeredSpans } from '../test/highlights';
import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { TextIndex } from './TextIndex';
import { TextPane } from './TextPane';

const TEXT = '# A paper\n\nWe scanned twenty patients on a 3 T scanner.\n\nControls were matched for age.\n';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const record = {
    description: ev('fMRI study', [at('scanned')]),
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [at('patients')]), n: ev(20, [at('twenty'), at('A paper')]) },
        {
            local_id: 'grp_b',
            name: ev('Controls', [at('Controls')]),
            species: notReported(),
            sex: ev('mixed'),
            age: ev('matched', [at('Controls'), at('age')]),
        },
    ],
};

const entities = entityRows(row('grp_a', 'Group', 'groups'), row('grp_b', 'Group', 'groups'));
const setup = () => renderWithStores(<TextPane />, makeBundle(record, TEXT, { entities }));
const styleText = () => [...document.querySelectorAll('style')].map((style) => style.textContent).join('');

describe('TextPane highlights', () => {
    it('registers the focused item’s spans as the focus highlight and all other evidence as underlines', () => {
        const { textRoot } = setup();
        expect(textRoot().textContent).toBe(TEXT);
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('scanned')]);
        expect(registeredSpans('rv-evidence', textRoot())).toEqual([
            at('A paper'),
            at('twenty'),
            at('patients'),
            at('Controls'),
            at('age'),
        ]);
    });

    it('changes only the registered ranges when focus changes, never the text DOM', () => {
        const { stores, textRoot } = setup();
        const before = TextIndex.build(textRoot()).textNodes();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('A paper'), at('twenty')]);
        expect(registeredSpans('rv-evidence', textRoot())).toEqual([
            at('scanned'),
            at('patients'),
            at('Controls'),
            at('age'),
        ]);
        const after = TextIndex.build(textRoot()).textNodes();
        expect(after).toHaveLength(before.length);
        after.forEach((node, i) => expect(node).toBe(before[i]));
    });

    it('registers the spans of all the slots of a focused entity as the focus highlight', () => {
        const { stores, textRoot } = setup();
        act(() => stores.view.getState().focusEntity('grp_b'));
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('Controls'), at('age')]);
        act(() => stores.view.getState().focusEntity('grp_a'));
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('A paper'), at('twenty'), at('patients')]);
    });

    it('keeps the underlines right after evidence is added and focus moves on', () => {
        const { stores, textRoot } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:name'));
        act(() => void stores.session.getState().addEvidence(stores.view.getState().focus.key, at('matched'), 'first'));
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('patients'), at('matched')]);
        expect(registeredSpans('rv-evidence', textRoot())).not.toContainEqual(at('matched'));
        act(() => stores.view.getState().focusSlot('slot:grp_b:name'));
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('Controls')]);
        expect(registeredSpans('rv-evidence', textRoot())).toEqual([
            at('A paper'),
            at('scanned'),
            at('twenty'),
            at('patients'),
            at('matched'),
            at('age'),
        ]);
    });

    it('fills the focused spans and underlines the rest with a dotted line', () => {
        setup();
        expect(styleText()).toContain('::highlight(rv-focus){background-color:rgba(0, 119, 182, 0.3);}');
        expect(styleText()).toContain(
            '::highlight(rv-evidence){text-decoration-line:underline;text-decoration-style:dotted;text-decoration-color:rgba(0, 119, 182, 0.45);}'
        );
    });
});

describe('TextPane evidence navigation', () => {
    const placeRangesByOffset = (root: HTMLElement, scroller: HTMLElement) =>
        vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(function (this: Range) {
            return { top: TextIndex.build(root).fromRange(this)![0] - scroller.scrollTop } as DOMRect;
        });

    it('counts the focused item’s evidence and steps through it with wrapping', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        expect(screen.getByText('evidence 1 of 2')).toBeInTheDocument();
        act(() => stores.view.getState().stepEvidence(1));
        expect(screen.getByText('evidence 2 of 2')).toBeInTheDocument();
        act(() => stores.view.getState().stepEvidence(1));
        expect(screen.getByText('evidence 1 of 2')).toBeInTheDocument();
        act(() => stores.view.getState().focusEntity('grp_a'));
        expect(screen.getByText('evidence 1 of 3')).toBeInTheDocument();
    });

    it('says when a slot has no evidence or was not reported', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_b:sex'));
        expect(screen.getByText('no evidence')).toBeInTheDocument();
        act(() => stores.view.getState().focusSlot('slot:grp_b:species'));
        expect(screen.getByText('not reported')).toBeInTheDocument();
    });

    it('scrolls the text to the focused slot’s first evidence span, then to the span stepped to', () => {
        const { stores, textRoot, container } = setup();
        const scroller = container.querySelector<HTMLElement>('[data-text-scroller]')!;
        placeRangesByOffset(textRoot(), scroller);
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        expect(scroller.scrollTop).toBe(at('A paper')[0]);
        act(() => stores.view.getState().stepEvidence(1));
        expect(scroller.scrollTop).toBe(at('twenty')[0]);
    });

    it('starts again at the first span, and scrolls to it, when another slot is focused after stepping', () => {
        const { stores, textRoot, container } = setup();
        const scroller = container.querySelector<HTMLElement>('[data-text-scroller]')!;
        placeRangesByOffset(textRoot(), scroller);
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        act(() => stores.view.getState().stepEvidence(1));
        act(() => stores.view.getState().focusSlot('slot:grp_b:age'));
        expect(screen.getByText('evidence 1 of 2')).toBeInTheDocument();
        expect(scroller.scrollTop).toBe(at('Controls')[0]);
    });
});

describe('TextPane clicks and Enter on highlights', () => {
    const clickAt = (scroller: HTMLElement, root: HTMLElement, offset: number) => {
        const range = TextIndex.build(root).toRange(offset, offset);
        document.caretRangeFromPoint = () => range;
        fireEvent.click(scroller, { clientX: 10, clientY: 10 });
    };
    const scrollerOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-text-scroller]')!;

    afterEach(() => {
        delete (document as { caretRangeFromPoint?: unknown }).caretRangeFromPoint;
    });

    it('focuses the one item a clicked span supports', () => {
        const { stores, textRoot, container } = setup();
        clickAt(scrollerOf(container), textRoot(), at('patients')[0] + 1);
        expect(stores.view.getState().focus.key).toBe('slot:grp_a:name');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('does nothing when the click is on text no evidence uses', () => {
        const { stores, textRoot, container } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        clickAt(scrollerOf(container), textRoot(), TEXT.indexOf('were'));
        expect(stores.view.getState().focus.key).toBe('slot:grp_a:n');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('lists the items a clicked span supports in a menu, and focuses the one chosen', () => {
        const { stores, textRoot, container } = setup();
        clickAt(scrollerOf(container), textRoot(), at('Controls')[0] + 1);
        const items = screen.getAllByRole('menuitem');
        expect(items.map((item) => item.textContent)).toEqual(['Controls · name', 'Controls · age']);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Controls · age' }));
        expect(stores.view.getState().focus.key).toBe('slot:grp_b:age');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('focuses the item under Enter on the evidence the cursor is on', () => {
        const { stores, container } = setup();
        act(() => stores.view.getState().focusEntity('grp_a'));
        fireEvent.keyDown(scrollerOf(container), { key: 'Enter' });
        expect(stores.view.getState().focus.key).toBe('slot:grp_a:n');
    });

    it('lists the items under Enter in a menu when the cursor span supports several', () => {
        const { stores, container } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_b:age'));
        fireEvent.keyDown(scrollerOf(container), { key: 'Enter' });
        fireEvent.click(screen.getByRole('menuitem', { name: 'Controls · name' }));
        expect(stores.view.getState().focus.key).toBe('slot:grp_b:name');
    });
});

describe('TextPane show all evidence', () => {
    it('is off at first, and its button says so', () => {
        setup();
        expect(screen.getByRole('button', { name: 'show all evidence' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('fills every evidence span when on, and leaves the focused item’s spans where they are', () => {
        const { stores, textRoot } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        fireEvent.click(screen.getByRole('button', { name: 'show all evidence' }));
        expect(screen.getByRole('button', { name: 'show all evidence' })).toHaveAttribute('aria-pressed', 'true');
        expect(stores.view.getState().showAllEvidence).toBe(true);
        expect(styleText()).toContain('::highlight(rv-evidence){background-color:');
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('A paper'), at('twenty')]);
        expect(registeredSpans('rv-evidence', textRoot())).toEqual([
            at('scanned'),
            at('patients'),
            at('Controls'),
            at('age'),
        ]);
    });

    it('goes back to underlines when switched off', () => {
        const { stores } = setup();
        fireEvent.click(screen.getByRole('button', { name: 'show all evidence' }));
        fireEvent.click(screen.getByRole('button', { name: 'show all evidence' }));
        expect(stores.view.getState().showAllEvidence).toBe(false);
        expect(styleText()).not.toContain('::highlight(rv-evidence){background-color:');
    });
});

describe('TextPane scrolls to an item’s first evidence', () => {
    it('scrolls to the first span, in reading order, of an entity focused by its id', () => {
        const { stores, textRoot, container } = setup();
        const scroller = container.querySelector<HTMLElement>('[data-text-scroller]')!;
        vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(function (this: Range) {
            return { top: TextIndex.build(textRoot()).fromRange(this)![0] - scroller.scrollTop } as DOMRect;
        });
        act(() => stores.view.getState().focusEntity('grp_b'));
        expect(scroller.scrollTop).toBe(at('Controls')[0]);
    });
});

describe('TextPane while the diff is shown', () => {
    const moved = structuredClone(record);
    moved.groups[0].n = ev(20, [at('twenty'), at('scanner')]);
    const diffSetup = () =>
        renderWithStores(
            <TextPane />,
            makeBundle(moved, TEXT, {
                entities,
                original: {
                    record: { local_id: 'P1', ...record },
                    coordinate_revision: null,
                    entities,
                    hidden: { analyses: [], entities: [] },
                },
            })
        );

    it('registers the original’s spans of the focused item beside the review’s, and a legend telling them apart', () => {
        const { stores, textRoot } = diffSetup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        expect(registeredSpans('rv-original', textRoot())).toEqual([]);
        expect(screen.queryByRole('note', { name: 'diff legend' })).not.toBeInTheDocument();
        act(() => stores.view.getState().toggleDiff(true));
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('twenty'), at('scanner')]);
        expect(registeredSpans('rv-original', textRoot())).toEqual([at('A paper'), at('twenty')]);
        expect(screen.getByRole('note', { name: 'diff legend' })).toHaveTextContent(/original.*review/);
        expect(styleText()).toMatch(/::highlight\(rv-original\)[^}]*dashed/);
        act(() => stores.view.getState().toggleDiff(false));
        expect(registeredSpans('rv-original', textRoot())).toEqual([]);
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('twenty'), at('scanner')]);
    });
});

describe('TextPane jump pulse', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('pulses the span a focus or a step scrolls to once, then takes the pulse away', () => {
        vi.useFakeTimers();
        const { stores, textRoot } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        expect(registeredSpans('rv-pulse', textRoot())).toEqual([at('A paper')]);
        act(() => stores.view.getState().stepEvidence(1));
        expect(registeredSpans('rv-pulse', textRoot())).toEqual([at('twenty')]);
        act(() => vi.advanceTimersByTime(600));
        expect(registeredSpans('rv-pulse', textRoot())).toEqual([]);
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('A paper'), at('twenty')]);
        expect(styleText()).toMatch(/::highlight\(rv-pulse\)\{background-color:/);
    });

    it('pulses a step for its full 600 ms, though an earlier jump’s pulse was still running', () => {
        vi.useFakeTimers();
        const { stores, textRoot } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        act(() => vi.advanceTimersByTime(400));
        act(() => stores.view.getState().stepEvidence(1));
        act(() => vi.advanceTimersByTime(300));
        expect(registeredSpans('rv-pulse', textRoot())).toEqual([at('twenty')]);
        act(() => vi.advanceTimersByTime(299));
        expect(registeredSpans('rv-pulse', textRoot())).toEqual([at('twenty')]);
        act(() => vi.advanceTimersByTime(1));
        expect(registeredSpans('rv-pulse', textRoot())).toEqual([]);
    });

    it('takes the pulse away when the pane goes mid-pulse', () => {
        vi.useFakeTimers();
        const { stores, unmount } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        expect(CSS.highlights.has('rv-pulse')).toBe(true);
        unmount();
        expect(CSS.highlights.has('rv-pulse')).toBe(false);
        act(() => vi.advanceTimersByTime(600));
        expect(CSS.highlights.has('rv-pulse')).toBe(false);
    });

    it('does not pulse while the reviewer asks for reduced motion, and keeps the focus highlight', () => {
        vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
        const { stores, textRoot } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        expect(registeredSpans('rv-pulse', textRoot())).toEqual([]);
        expect(registeredSpans('rv-focus', textRoot())).toEqual([at('A paper'), at('twenty')]);
    });
});
