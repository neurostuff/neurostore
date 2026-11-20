import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import type { Op } from '../contract/generated/review-ops';
import { keysNamed } from '../model/analysisFollow';
import { slotKey } from '../model/targetKey';
import { ReviewScreen } from '../review/ReviewScreen';
import { createReviewSession } from '../store/reviewSession';
import { selectSaveLabel } from '../store/sessionStore';
import { coordinateBundle, CUNEUS, FACES, HOUSES, INSULA, point, PRECUNEUS } from '../test/coordinates';
import { fakeServer } from '../test/fakeServer';
import type { ReviewStores } from '../store/reviewStores';
import { engageGrid } from '../test/grid';
import { renderStores } from '../test/render';
import { at, enter, headButton, headOf, openSaving, refusing, SLOW, type SavingView } from '../test/savingView';
import { saveSlotValue } from './actions';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 30_000 });

let stop: (() => void) | undefined;
afterEach(() => stop?.());

async function open() {
    const view = await openSaving();
    stop = () => view.client.stop();
    return view;
}

const keyOf = (op: Op) => (op as { target: { analysis_key?: string } }).target?.analysis_key;
const target = (analysis_key: string) => ({ kind: 'coordinate_analysis', analysis_key });
const provenanceOf = (view: SavingView, key: string) =>
    view.stores.session.getState().provenance[`coordinate_analysis:${key}`]?.state;
const queued = (view: SavingView) =>
    view.stores.session.getState().pending.map((op) => ('action' in op ? op.action : op.type));
const pointActions = () => screen.getByRole('group', { name: /^actions on (point \d+|the points) of / });
const kept = (name: string) => screen.getByRole('note', { name: `kept ${name}` });

/** The keys the stored op `seq` (from 0) put in place, as the server stored it. */
async function made(view: SavingView, seq: number) {
    const stored = (await view.server.backend.getBundle('P1')).ops[seq];
    return (stored.after as { analyses: { analysis: { key: string } }[] }).analyses.map((a) => a.analysis.key);
}

/** Edits a point and sends it, the server's answer held. */
async function editOut(view: SavingView) {
    const release = view.hold();
    act(() => view.hot().edit(0, 'z', 42));
    await view.sendOut();
    return release;
}

/** Splits the selected points off, the server's answer held. */
async function splitOut(view: SavingView, selected: number[]) {
    act(() => view.stores.view.getState().selectPoints(selected));
    const release = view.hold();
    fireEvent.click(headButton('Split'));
    await waitFor(() => expect(view.posted()).toHaveLength(1), SLOW);
    return release;
}

const moveTo = (stores: ReviewStores, selected: number[], name: string) => {
    act(() => stores.view.getState().selectPoints(selected));
    fireEvent.click(within(pointActions()).getByRole('button', { name: 'Move to…' }));
    fireEvent.click(screen.getByRole('option', { name: new RegExp(name) }));
};

const accept = () => fireEvent.click(headButton('Accept'));
const reject = () => {
    fireEvent.click(headButton('Reject'));
    const panel = screen.getByRole('group', { name: /^reject / });
    act(() => void fireEvent.keyDown(panel, { key: '4' }));
    enter(panel);
};
const note = (text: string) => {
    fireEvent.click(headButton('Note'));
    const field = screen.getByRole('textbox', { name: /^note on / });
    fireEvent.change(field, { target: { value: text } });
    enter(field);
};
const changeRole = (role: string) => {
    fireEvent.click(headButton('Change role'));
    const field = screen.getByRole('combobox', { name: 'role' });
    fireEvent.change(field, { target: { value: role } });
    enter(field);
};
const editAnalysis = (fields: { name?: string; space?: string }) => {
    fireEvent.click(headButton('Edit analysis'));
    const form = screen.getByRole('group', { name: /^edit analysis / });
    if (fields.name)
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), { target: { value: fields.name } });
    if (fields.space)
        fireEvent.change(within(form).getByRole('combobox', { name: 'coordinate space' }), {
            target: { value: fields.space },
        });
    enter(within(form).getByRole('textbox', { name: 'name' }));
};
const rename = (name: string) => {
    fireEvent.click(within(headOf()).getByRole('button', { name: /^rename / }));
    const field = within(headOf()).getByRole('textbox', { name: 'analysis name' });
    fireEvent.change(field, { target: { value: name } });
    enter(field);
};

describe('the head once an edit has saved', () => {
    it('reads saved, keeps Reject enabled, and lists only why Split and Merge do not apply', async () => {
        const view = await open();
        for (const z of [42, 43]) {
            const release = view.hold();
            act(() => view.hot().edit(0, 'z', z));
            act(() => void view.client.flush());
            act(() => release());
            await view.saved();
        }
        expect(view.status()).toHaveTextContent(/^saved$/);
        expect(headButton('Reject')).toBeEnabled();
        const reasons = within(headOf()).getByRole('list', { name: 'why some actions do not apply' });
        expect(
            within(reasons)
                .getAllByRole('listitem')
                .map((line) => line.textContent)
        ).toEqual([
            'Select the points to split off: drag over rows or press Space',
            'Merge joins whole analyses: Shift-click another analysis’s card; to put these points in another analysis, use Move to…',
        ]);
    });
});

interface WhileSaving {
    press: (view: SavingView) => void;
    shows: (view: SavingView) => void;
    sends: Record<string, unknown>;
}

describe('an analysis action pressed while its edit saves', () => {
    it.each<[string, WhileSaving]>([
        [
            'Accept',
            {
                press: accept,
                shows: (view) => {
                    expect(provenanceOf(view, FACES.key)).toBe('verified');
                    expect(within(headOf()).getByText(/^verified/)).toBeInTheDocument();
                },
                sends: { type: 'verdict', verdict: 'accept' },
            },
        ],
        [
            'Reject',
            {
                press: reject,
                shows: (view) => {
                    expect(provenanceOf(view, FACES.key)).toBe('removed');
                    expect(within(headOf()).getByText(/^rejected/)).toBeInTheDocument();
                },
                sends: { type: 'verdict', verdict: 'reject' },
            },
        ],
        [
            'Note',
            {
                press: () => note('two peaks'),
                shows: () =>
                    expect(within(headOf()).getByRole('img', { name: 'noted: two peaks' })).toBeInTheDocument(),
                sends: { type: 'note', note: 'two peaks' },
            },
        ],
        [
            'Edit analysis',
            {
                press: () => editAnalysis({ name: 'Faces > Places' }),
                shows: () => expect(headOf()).toHaveAccessibleName('Faces > Places: card head'),
                sends: { type: 'coordinate', action: 'edit_points' },
            },
        ],
        [
            'rename',
            {
                press: () => rename('Faces > Places'),
                shows: () => expect(headOf()).toHaveAccessibleName('Faces > Places: card head'),
                sends: { type: 'coordinate', action: 'edit_points' },
            },
        ],
        [
            'Change role',
            {
                press: () => changeRole('anchor'),
                shows: () => expect(within(headOf()).getByText('anchor')).toBeInTheDocument(),
                sends: { type: 'coordinate', action: 'relabel', role: 'anchor' },
            },
        ],
        [
            'Split',
            {
                press: (view) => {
                    act(() => view.stores.view.getState().selectPoints([0]));
                    fireEvent.click(headButton('Split'));
                },
                shows: (view) => expect(queued(view).at(-1)).toBe('split'),
                sends: { type: 'coordinate', action: 'split' },
            },
        ],
        [
            'Merge',
            {
                press: (view) => {
                    act(() => view.stores.view.getState().toggleMerge(HOUSES.key));
                    fireEvent.click(headButton('Merge'));
                    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Merge' }));
                },
                shows: (view) => expect(queued(view).at(-1)).toBe('merge'),
                sends: { type: 'coordinate', action: 'merge' },
            },
        ],
        [
            'Move to…',
            {
                press: (view) => moveTo(view.stores, [1], HOUSES.name),
                shows: (view) => expect(queued(view).slice(-2)).toEqual(['edit_points', 'edit_points']),
                sends: { type: 'coordinate', action: 'edit_points', payload: { points: [at(PRECUNEUS, 42)] } },
            },
        ],
        [
            'Edit point',
            {
                press: (view) => {
                    fireEvent.click(within(pointActions()).getByRole('button', { name: 'Edit point' }));
                    act(() => view.hot().edit(1, 'z', 7));
                },
                shows: (view) => expect(view.hot().rows.map((row) => row.z)).toEqual([42, 7]),
                sends: {
                    type: 'coordinate',
                    action: 'edit_points',
                    payload: { points: [at(PRECUNEUS, 42), at(INSULA, 7)] },
                },
            },
        ],
    ])('%s is enabled, applies at once, and arrives after the edit on the key it gave', async (_, action) => {
        const view = await open();
        const release = await editOut(view);
        action.press(view);
        action.shows(view);
        expect(screen.queryByText(/wait/i)).not.toBeInTheDocument();
        act(() => release());
        await view.saved();
        const [key] = await made(view, 0);
        expect(view.posted()[0]).toEqual([expect.objectContaining({ action: 'edit_points' })]);
        expect(view.posted().slice(1).flat()).toContainEqual(
            expect.objectContaining({ ...action.sends, target: target(key) })
        );
    });

    it('shows a change of coordinate space on the card at once', async () => {
        const view = await open();
        await editOut(view);
        editAnalysis({ space: 'TAL' });
        expect(screen.getByRole('article', { name: FACES.name })).toHaveTextContent(/^.*TAL · from Table 1/);
    });

    it('renames from the record’s name slot, arriving after the edit on the key it gave', async () => {
        const view = await open();
        const release = await editOut(view);
        const slot = view.stores.session.getState().index.slot(slotKey('ana_faces', 'name'))!;
        const value = { extraction_status: 'extracted', value: 'Faces > Places', value_source: 'reported' } as const;
        act(() => void saveSlotValue(view.stores, slot, value));
        expect(headOf()).toHaveAccessibleName('Faces > Places: card head');
        act(() => release());
        await view.saved();
        const [key] = await made(view, 0);
        expect(view.posted()[1]).toEqual([
            expect.objectContaining({ type: 'set_value', value }),
            expect.objectContaining({ action: 'edit_points', target: target(key) }),
        ]);
    });
});

describe('ops applied at once land once, on the server’s record', () => {
    it('an accept is on the key the edit gave once the result is in, not on the old one', async () => {
        const view = await open();
        const release = await editOut(view);
        accept();
        act(() => release());
        await view.saved();
        const [key] = await made(view, 0);
        expect(provenanceOf(view, key)).toBe('verified');
        expect(provenanceOf(view, FACES.key)).toBeUndefined();
    });

    it('a note shows once', async () => {
        const view = await open();
        const release = await editOut(view);
        note('two peaks');
        act(() => release());
        await view.saved();
        expect(
            within(headOf())
                .getAllByRole('img', { name: /^noted:/ })
                .map((mark) => mark.title)
        ).toEqual(['two peaks']);
    });

    it('an accept behind a refused edit still shows on the analysis as it was', async () => {
        const view = await open();
        const release = await editOut(view);
        accept();
        act(() => release(refusing('too far out')));
        await view.settled();
        expect(provenanceOf(view, FACES.key)).toBe('verified');
        expect(within(headOf()).getByText(/^verified/)).toBeInTheDocument();
    });
});

describe('a point-index action right after a point edit', () => {
    it('splits the points the reviewer selected, on the analysis the edit gave', async () => {
        const view = await open();
        const release = await editOut(view);
        act(() => view.hot().paste(2, 0, [['1', '2', '3']]));
        act(() => view.stores.view.getState().selectPoints([2]));
        fireEvent.click(headButton('Split'));
        act(() => release());
        await view.saved();
        const parts = view.analyses().filter((a) => a.name.includes('(part'));
        expect(parts.map((part) => part.points)).toEqual([[point([1, 2, 3])], [at(PRECUNEUS, 42), INSULA]]);
    });
});

describe('a Move queued behind a split of its analysis', () => {
    it('is kept whole: nothing reaches the analysis it moves to, and nothing is sent twice', async () => {
        const view = await open();
        const release = await splitOut(view, [0]);
        moveTo(view.stores, [1], HOUSES.name);
        act(() => release());
        await view.settled();
        expect(
            view
                .posted()
                .slice(1)
                .flat()
                .filter((op) => keysNamed(op).includes(HOUSES.key))
        ).toEqual([]);
        expect(view.posted()).toHaveLength(1);
        expect(view.analyses().find((a) => a.key === HOUSES.key)?.points).toEqual([CUNEUS]);
        expect(view.stores.session.getState().heldOps).toEqual([
            expect.objectContaining({ ops: [expect.anything(), expect.anything()] }),
        ]);
        expect(kept(`move from ${FACES.name}`)).toHaveTextContent(`Move from ${FACES.name} kept, not sent`);
        fireEvent.click(within(kept(`move from ${FACES.name}`)).getByRole('button', { name: 'Discard' }));
        expect(selectSaveLabel(view.stores.session.getState())).toBe('saved');
    });
});

describe('a whole-analysis action pressed while a split of it is out', () => {
    it.each<[string, () => void, Record<string, unknown>]>([
        ['Accept', accept, { type: 'verdict', verdict: 'accept' }],
        ['Reject', reject, { type: 'verdict', verdict: 'reject' }],
        ['Note', () => note('two peaks'), { type: 'note', note: 'two peaks' }],
        ['Change role', () => changeRole('anchor'), { type: 'coordinate', action: 'relabel', role: 'anchor' }],
    ])('%s lands on every part the split makes', async (_, press, sends) => {
        const view = await open();
        const release = await splitOut(view, [0]);
        press();
        act(() => release());
        await view.settled();
        const parts = await made(view, 0);
        expect(parts).toHaveLength(2);
        const later = view.posted().slice(1).flat();
        for (const part of parts)
            expect(later).toContainEqual(expect.objectContaining({ ...sends, target: target(part) }));
        expect(later.filter((op) => keyOf(op) === FACES.key)).toEqual([]);
    });

    it('a Merge is kept, not sent on a part', async () => {
        const view = await open();
        const release = await splitOut(view, [0]);
        act(() => view.stores.view.getState().toggleMerge(HOUSES.key));
        fireEvent.click(headButton('Merge'));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Merge' }));
        act(() => release());
        await view.settled();
        expect(view.posted()).toHaveLength(1);
        expect(kept(`merge into ${FACES.name}`)).toBeInTheDocument();
    });
});

describe('a split queued behind a split', () => {
    it('is kept, its Apply disabled with the reason, since no part holds its points', async () => {
        const view = await open();
        const release = await splitOut(view, [0]);
        act(() => view.stores.view.getState().selectPoints([1]));
        fireEvent.click(headButton('Split'));
        act(() => release());
        await view.settled();
        expect(view.posted()).toHaveLength(1);
        const note = kept(`split of ${FACES.name}`);
        expect(note).toHaveTextContent(
            `Split of ${FACES.name} kept, not sent: the analysis was replaced before it could be sent`
        );
        expect(within(note).getByRole('button', { name: /^Apply to / })).toBeDisabled();
        expect(note).toHaveTextContent(/the points it was made on are no longer in Faces > Houses \(part \d\)/);
        expect(selectSaveLabel(view.stores.session.getState())).toBe('1 unsaved');
        fireEvent.click(within(note).getByRole('button', { name: 'Discard' }));
        expect(selectSaveLabel(view.stores.session.getState())).toBe('saved');
    });
});

describe('an action queued behind a point edit the server refuses', () => {
    it('a verdict and a relabel stay queued and are sent on the analysis as it was', async () => {
        const view = await open();
        const release = await editOut(view);
        accept();
        changeRole('anchor');
        act(() => release(refusing('too far out')));
        await view.settled();
        expect(view.posted()[1]).toEqual([
            expect.objectContaining({ type: 'verdict', target: target(FACES.key) }),
            expect.objectContaining({ action: 'relabel', target: target(FACES.key) }),
        ]);
        expect(view.hot().rows.map((row) => row.z)).toEqual([42, 2]);
        expect(view.status()).toHaveTextContent('not saved: too far out');
    });

    it('a split made after a paste that added a point is kept, never sent, its Apply disabled', async () => {
        const view = await open();
        const release = view.hold();
        act(() => view.hot().paste(2, 0, [['1', '2', '3']]));
        await view.sendOut();
        act(() => view.stores.view.getState().selectPoints([2]));
        fireEvent.click(headButton('Split'));
        act(() => release(refusing('too far out')));
        await view.settled();
        expect(view.posted()).toHaveLength(1);
        expect(view.stores.session.getState().notices.map((n) => n.op?.client_op_id)).toEqual([
            view.posted()[0][0].client_op_id,
        ]);
        const note = kept(`split of ${FACES.name}`);
        expect(note).toHaveTextContent(`Split of ${FACES.name} kept, not sent: too far out`);
        expect(within(note).getByRole('button', { name: `Apply to ${FACES.name}` })).toBeDisabled();
        expect(note).toHaveTextContent(`the points it was made on are no longer in ${FACES.name}`);
    });

    it('a split made after rows moved is kept, and Apply splits the same points on the server’s order', async () => {
        const view = await open();
        const release = view.hold();
        act(() => void view.stores.session.getState().collect(FACES.key, [INSULA, PRECUNEUS]));
        await view.sendOut();
        act(() => view.stores.view.getState().selectPoints([0]));
        fireEvent.click(headButton('Split'));
        act(() => release(refusing('too far out')));
        await view.settled();
        expect(view.posted()).toHaveLength(1);
        const note = kept(`split of ${FACES.name}`);
        fireEvent.click(within(note).getByRole('button', { name: `Apply to ${FACES.name}` }));
        await view.settled();
        expect(view.posted().at(-1)).toEqual([
            expect.objectContaining({
                action: 'split',
                target: target(FACES.key),
                payload: { parts: [{ indices: [1] }, { indices: [0] }] },
            }),
        ]);
        const parts = view.analyses().filter((a) => a.name.includes('(part'));
        expect(parts.map((part) => part.points)).toEqual([[INSULA], [PRECUNEUS]]);
    });

    it.each<[string, () => void]>([
        ['a rename', () => rename('Faces > Places')],
        ['an Edit analysis with a space change', () => editAnalysis({ space: 'TAL' })],
    ])('%s is kept, not sent with the refused points', async (_, press) => {
        const view = await open();
        const release = await editOut(view);
        press();
        act(() => release(refusing('too far out')));
        await view.settled();
        expect(view.posted()).toHaveLength(1);
        expect(kept(`edit of ${FACES.name}`)).toHaveTextContent(`Edit of ${FACES.name} kept, not sent: too far out`);
    });
});

describe('a held op after a reload', () => {
    it('shows on the card, its Apply disabled with the reason and Discard working, from a real split and Move', async () => {
        const server = fakeServer([coordinateBundle({ review: null })]);
        await server.backend.startReview('P1');
        const indexedDB = new IDBFactory();
        const tab = async () => {
            const session = createReviewSession(await server.backend.getBundle('P1'), server.api(), {
                indexedDB,
                locks: undefined,
            });
            await session.open();
            return session;
        };
        const one = await tab();
        stop = () => one.close();
        const shown = renderStores(<ReviewScreen />, one.stores, one.client);
        await engageGrid(FACES.name);
        let release = () => {};
        const released = new Promise<void>((resolve) => (release = resolve));
        server.intercept(async () => {
            await released;
            return undefined;
        });
        act(() => one.stores.view.getState().selectPoints([0]));
        fireEvent.click(headButton('Split'));
        await waitFor(() => expect(server.requests.filter((r) => r.method === 'POST')).toHaveLength(1), SLOW);
        moveTo(one.stores, [1], HOUSES.name);
        act(() => release());
        await waitFor(() => expect(one.stores.session.getState().heldOps).toHaveLength(1), SLOW);
        await one.client.settled();
        shown.unmount();
        await one.close();

        const two = await tab();
        stop = () => two.close();
        renderStores(<ReviewScreen />, two.stores, two.client);
        const note = await screen.findByRole('note', { name: `kept move from ${FACES.name}` }, SLOW);
        expect(within(note).getByRole('button', { name: /^Apply to / })).toBeDisabled();
        expect(note).toHaveTextContent(/the points it was made on are no longer in /);
        fireEvent.click(within(note).getByRole('button', { name: 'Discard' }));
        expect(two.stores.session.getState().heldOps).toEqual([]);
        expect(selectSaveLabel(two.stores.session.getState())).toBe('saved');
    });
});
