import { act, fireEvent, screen } from '@testing-library/react';
import type { Op, SetEvidenceOp } from '../contract/generated/review-ops';
import { slotKey } from '../model/targetKey';
import { ReviewScreen } from '../review/ReviewScreen';
import type { OpClient } from '../store/opClient';
import type { ReviewStores } from '../store/reviewStores';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { registeredSpans } from '../test/highlights';
import { renderThroughServer, renderWithStores } from '../test/render';
import { TextIndex } from './TextIndex';
import { TextPane } from './TextPane';

const TEXT = 'We scanned twenty patients on a 3 T scanner.\nTable 1\nRegion\tx\nInsula\t-2\n';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const record = {
    groups: [
        {
            local_id: 'grp_a',
            name: ev('Patients', [at('patients')]),
            n: ev(20, [at('twenty')]),
            region: ev('insula', [at('Insula')]),
        },
    ],
};
const entities = entityRows(row('grp_a', 'Group', 'groups'));
const PAPER = { bibliography: { title: 'A paper' }, tables: [{ table_id: 't1', label: 'Table 1' }] };
const review = { id: 'r1', user_id: 'u1', state: 'in_progress', last_seq: 0, provenance: {}, annotations: {} } as const;

/** Lays each span out on one line, eight pixels a character. */
function placeRects(root: () => HTMLElement | null) {
    vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
        const [start, end] = TextIndex.build(root()!).fromRange(this)!;
        return [new DOMRect(start * 8, 20, (end - start) * 8, 16)] as unknown as DOMRectList;
    });
}

function setup(slot = 'slot:grp_a:name') {
    const view = renderWithStores(
        <TextPane />,
        makeBundle(record, TEXT, { entities, parsed_paper: PAPER, review: { ...review } })
    );
    placeRects(view.textRoot);
    act(() => view.stores.view.getState().focusSlot(slot));
    return view;
}

const handle = (end: 'start' | 'end') => screen.queryByRole('button', { name: `move the evidence ${end}` });
const spansOf = (stores: ReturnType<typeof setup>['stores'], key = 'slot:grp_a:name') =>
    stores.session.getState().index.slot(key)?.spans;

/** Drags a handle to the character at `offset`, by where the browser puts the caret. */
function drag(root: HTMLElement, end: 'start' | 'end', ...offsets: number[]) {
    const target = handle(end)!;
    expect(target).toBeInTheDocument();
    fireEvent.pointerDown(target, { pointerId: 1 });
    for (const offset of offsets) {
        const range = TextIndex.build(root).toRange(offset, offset);
        document.caretRangeFromPoint = () => range;
        fireEvent.pointerMove(target, { pointerId: 1 });
    }
    fireEvent.pointerUp(target, { pointerId: 1 });
}

afterEach(() => {
    delete (document as { caretRangeFromPoint?: unknown }).caretRangeFromPoint;
});

const remove = () => screen.getByRole('button', { name: 'remove this evidence span' });

/** Wraps every span onto two lines, ending mid-line at x = 64 on the second, in a text column ending at `columnRight` inside a scroller `scrollerWidth` wide. */
function wrapRects(columnRight: number, scrollerWidth: number) {
    vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(
        () => [new DOMRect(200, 20, 100, 16), new DOMRect(0, 40, 64, 16)] as unknown as DOMRectList
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-text-root') ? new DOMRect(0, 0, columnRight, 100) : new DOMRect(0, 0, 0, 0);
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-text-scroller') ? scrollerWidth : 0;
    });
}

describe('span handles', () => {
    it('puts the remove control in the margin at the text column’s edge, on the row of the span’s end', () => {
        const view = renderWithStores(
            <TextPane />,
            makeBundle(record, TEXT, { entities, parsed_paper: PAPER, review: { ...review } })
        );
        wrapRects(400, 440);
        act(() => view.stores.view.getState().focusSlot('slot:grp_a:name'));
        expect(remove()).toHaveStyle({ left: '404px', top: '38px' });
    });

    it('shrinks the gap where the margin is narrow, keeping the remove control outside the text column', () => {
        const view = renderWithStores(
            <TextPane />,
            makeBundle(record, TEXT, { entities, parsed_paper: PAPER, review: { ...review } })
        );
        wrapRects(400, 412);
        act(() => view.stores.view.getState().focusSlot('slot:grp_a:name'));
        expect(remove()).toHaveStyle({ left: '400px', top: '38px' });
    });

    it('puts a start and an end handle at the ends of the focused span', () => {
        setup();
        expect(handle('start')).toHaveStyle({ left: `${at('patients')[0] * 8}px`, top: '20px' });
        expect(handle('end')).toHaveStyle({ left: `${at('patients')[1] * 8}px`, top: '20px' });
    });

    it('shows no handles while an entity is focused, nor on a span in a table cell', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusEntity('grp_a'));
        expect(handle('start')).toBeNull();
        act(() => stores.view.getState().focusSlot('slot:grp_a:region'));
        expect(handle('start')).toBeNull();
        expect(handle('end')).toBeNull();
    });

    it('drags the end to the end of the word it is dropped in, previewing it, in one edit', () => {
        const { stores, textRoot } = setup();
        const target = handle('end')!;
        expect(target).toBeInTheDocument();
        fireEvent.pointerDown(target, { pointerId: 1 });
        const range = TextIndex.build(textRoot()).toRange(TEXT.indexOf('cann'), TEXT.indexOf('cann'));
        document.caretRangeFromPoint = () => range;
        fireEvent.pointerMove(target, { pointerId: 1 });
        fireEvent.pointerMove(target, { pointerId: 1 });
        const middle = TEXT.indexOf('anner') + 2;
        const later = TextIndex.build(textRoot()).toRange(middle, middle);
        document.caretRangeFromPoint = () => later;
        fireEvent.pointerMove(target, { pointerId: 1 });
        const moved: [number, number] = [at('patients')[0], at('scanner')[1]];
        expect(registeredSpans('rv-moving', textRoot())).toEqual([moved]);
        expect(stores.session.getState().pending).toEqual([]);
        fireEvent.pointerUp(target, { pointerId: 1 });
        expect(registeredSpans('rv-moving', textRoot())).toEqual([]);
        expect(spansOf(stores)).toEqual([moved]);
        expect(stores.session.getState().pending).toHaveLength(1);
        expect(stores.session.getState().undoStack).toHaveLength(1);
        expect(handle('end')).toHaveStyle({ left: `${moved[1] * 8}px` });
    });

    it('drags the start to the start of a word, and never past the end', () => {
        const { stores, textRoot } = setup();
        drag(textRoot(), 'start', TEXT.indexOf('enty'));
        expect(spansOf(stores)).toEqual([[at('twenty')[0], at('patients')[1]]]);
        drag(textRoot(), 'start', TEXT.indexOf('scanner'));
        expect(spansOf(stores)).toEqual([[at('patients')[0], at('patients')[1]]]);
        drag(textRoot(), 'end', 0);
        expect(spansOf(stores)).toEqual([at('patients')]);
        expect(stores.session.getState().pending).toHaveLength(2);
    });
});

describe('a drag that does not end in a drop', () => {
    it('takes the preview away and sends nothing when the pointer is cancelled', () => {
        const { stores, textRoot } = setup();
        const target = handle('end')!;
        fireEvent.pointerDown(target, { pointerId: 1 });
        const range = TextIndex.build(textRoot()).toRange(TEXT.indexOf('anner'), TEXT.indexOf('anner'));
        document.caretRangeFromPoint = () => range;
        fireEvent.pointerMove(target, { pointerId: 1 });
        expect(registeredSpans('rv-moving', textRoot())).toEqual([[at('patients')[0], at('scanner')[1]]]);
        fireEvent.pointerCancel(target, { pointerId: 1 });
        expect(registeredSpans('rv-moving', textRoot())).toEqual([]);
        fireEvent.pointerUp(target, { pointerId: 1 });
        expect(stores.session.getState().pending).toEqual([]);
        expect(spansOf(stores)).toEqual([at('patients')]);
        expect(handle('end')).toHaveStyle({ left: `${at('patients')[1] * 8}px` });
    });

    it('sends nothing, and makes no undo step, for a release without a move', () => {
        const { stores } = setup();
        drag(document.body, 'end');
        drag(document.body, 'start');
        expect(stores.session.getState().pending).toEqual([]);
        expect(stores.session.getState().undoStack).toEqual([]);
    });
});

describe('the remove control', () => {
    it('is shown on a span in a table cell, though the handles are not', () => {
        const { stores } = setup('slot:grp_a:region');
        expect(handle('start')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'remove this evidence span' }));
        expect(spansOf(stores, 'slot:grp_a:region')).toEqual([]);
    });

    it('removes the focused span in one edit', () => {
        const { stores } = setup();
        fireEvent.click(screen.getByRole('button', { name: 'remove this evidence span' }));
        expect(spansOf(stores)).toEqual([]);
        expect(stores.session.getState().undoStack).toHaveLength(1);
    });

    it('is disabled, and the handles too, in a tab another one holds the review in', () => {
        const { stores, textRoot } = setup();
        act(() => stores.session.getState().setDevice('readonly'));
        expect(screen.getByRole('button', { name: 'remove this evidence span' })).toBeDisabled();
        expect(handle('end')).toHaveAttribute('aria-disabled', 'true');
        drag(textRoot(), 'end', TEXT.indexOf('scanner'));
        expect(spansOf(stores)).toEqual([at('patients')]);
        expect(registeredSpans('rv-moving', textRoot())).toEqual([]);
    });
});

describe('span edits through the server', () => {
    const WIDE = 'Den 𝛼 cohort: 😀 twenty patients.';
    const wide = (word: string): [number, number] => [WIDE.indexOf(word), WIDE.indexOf(word) + word.length];
    const DESCRIPTION = slotKey('study', 'description');
    let server: FakeServer;
    let client: OpClient;

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    });

    afterEach(() => {
        client.stop();
        vi.useRealTimers();
        expect(server.invalid()).toEqual([]);
    });

    async function open() {
        server = fakeServer([
            makeBundle({ description: ev('A study', [[16, 22]]) }, WIDE, {
                source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
            }),
        ]);
        const view = await renderThroughServer(<ReviewScreen />, server, 'S1');
        client = view.client;
        const { stores } = view;
        placeRects(view.textRoot);
        act(() => stores.view.getState().focusSlot(DESCRIPTION));
        return { stores, textRoot: view.textRoot };
    }

    const saved = async () => {
        await act(() => vi.advanceTimersByTimeAsync(1000));
        await act(() => client.settled());
    };
    const posts = () => server.requests.filter((r) => r.method === 'POST');
    const sentEvidence = (i: number) => (posts()[i].body as { ops: Op[] }).ops[0] as SetEvidenceOp;
    const recordSpans = (stores: ReviewStores) =>
        (
            stores.session.getState().record as { description: { evidence?: SetEvidenceOp['evidence'] } }
        ).description.evidence?.sets?.flatMap((set) => set.spans.map((span) => [span.start_char, span.end_char]));
    const undo = () => act(() => void fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }));

    it.each([
        ['Backspace', () => act(() => void fireEvent.keyDown(document.body, { key: 'Backspace' }))],
        [
            'the remove control',
            () => fireEvent.click(screen.getByRole('button', { name: 'remove this evidence span' })),
        ],
    ])(
        'removes the focused span with %s, and one undo brings it back in the record and the handles',
        async (_, remove) => {
            const { stores } = await open();
            expect(handle('end')).toHaveStyle({ left: `${wide('twenty')[1] * 8}px` });
            remove();
            await saved();
            expect(sentEvidence(0).evidence).toEqual({ status: 'not_found' });
            expect(handle('end')).toBeNull();
            undo();
            await saved();
            expect(posts()).toHaveLength(2);
            expect(recordSpans(stores)).toEqual([wide('twenty')]);
            expect(stores.session.getState().index.slot(DESCRIPTION)?.spans).toEqual([wide('twenty')]);
            expect(handle('start')).toHaveStyle({ left: `${wide('twenty')[0] * 8}px` });
            expect(handle('end')).toHaveStyle({ left: `${wide('twenty')[1] * 8}px` });
        }
    );

    it('drags the end over astral text, sending code points, and one undo puts the handle and the spans back', async () => {
        const { stores, textRoot } = await open();
        drag(textRoot(), 'end', WIDE.indexOf('tients'));
        await saved();
        expect(sentEvidence(0).evidence).toMatchObject({ sets: [{ spans: [{ start_char: 16, end_char: 31 }] }] });
        expect(handle('end')).toHaveStyle({ left: `${wide('patients')[1] * 8}px` });
        undo();
        await saved();
        expect(posts()).toHaveLength(2);
        expect(stores.session.getState().index.slot(DESCRIPTION)?.spans).toEqual([wide('twenty')]);
        expect(handle('end')).toHaveStyle({ left: `${wide('twenty')[1] * 8}px` });
    });
});
