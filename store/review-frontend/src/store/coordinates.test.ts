import type { OpResult } from '../api/reviewApi';
import type { Op } from '../contract/generated/review-ops';
import { fromCodePoints } from '../model/offsets';
import {
    COORD_TEXT,
    CUNEUS,
    coordinateBundle,
    coordinateResult,
    FACES,
    HOUSES,
    INSULA,
    key,
    LOCALIZER,
    PRECUNEUS,
    revision,
    SCRAMBLED,
    span,
} from '../test/coordinates';
import { linkedBundle, RECORDED } from '../test/linked';
import { createReviewStore } from './reviewStore';

const open = () => createReviewStore(coordinateBundle(), { now: () => 'now' });
const rowOf = (text: string): [number, number] => {
    const start = COORD_TEXT.indexOf(text);
    return [start, start + text.length];
};
const PRECUNEUS_ROW = rowOf('Precuneus\t4\t−60\t40\t5.1');
const INSULA_ROW = rowOf('Insula\t-36\t20\t2\t4.2');
const CUNEUS_ROW = rowOf('Cuneus\t10\t-80\t12\t3.3');
const CUNEUS_POINT = CUNEUS;

/** The restore that undoes the add of the analysis at `index`: the coordinate op that takes an analysis away whole. */
const undoingAdd = (client_op_id: string, analysis: object, index: number): Op => ({
    client_op_id,
    type: 'coordinate',
    target: { kind: 'coordinate_parse' },
    action: 'restore',
    payload: { remove: [{ index, analysis }], insert: [], reasons: {}, record: { remove: [], insert: [] } },
});

describe('the coordinates step’s focus', () => {
    it('opens on the first analysis, its points’ rows highlighted', () => {
        const state = open().getState();
        expect(state.step).toBe('coordinates');
        expect(state.coordinates).toEqual({ analysis: FACES.key, point: null, selected: [] });
        expect(state.focusedSpans).toEqual([PRECUNEUS_ROW, INSULA_ROW]);
    });

    it('focuses a point, highlighting the table row it is read from and revealing it', () => {
        const store = open();
        store.getState().focusAnalysis(FACES.key, 1);
        expect(store.getState().coordinates).toEqual({ analysis: FACES.key, point: 1, selected: [] });
        expect(store.getState().focusedSpans).toEqual([INSULA_ROW]);
        expect(store.getState().reveal?.span).toEqual(INSULA_ROW);
    });

    it('J and K step through the points, K from the first point back to the analysis', () => {
        const store = open();
        store.getState().movePoint(1);
        expect(store.getState().coordinates?.point).toBe(0);
        store.getState().movePoint(1);
        store.getState().movePoint(1);
        expect(store.getState().coordinates?.point).toBe(1);
        store.getState().movePoint(-1);
        store.getState().movePoint(-1);
        expect(store.getState().coordinates?.point).toBeNull();
    });

    it('Shift+J and Shift+K step through the analyses in guided order, leaving out those with no points', () => {
        const store = open();
        store.getState().moveAnalysis(1);
        expect(store.getState().coordinates?.analysis).toBe(HOUSES.key);
        expect(store.getState().focusedSpans).toEqual([CUNEUS_ROW]);
        store.getState().moveAnalysis(1);
        store.getState().moveAnalysis(1);
        expect(store.getState().coordinates?.analysis).toBe(LOCALIZER.key);
        store.getState().toggleNonCoordinate();
        store.getState().moveAnalysis(1);
        expect(store.getState().coordinates?.analysis).toBe(SCRAMBLED.key);
        store.getState().moveAnalysis(-1);
        expect(store.getState().coordinates?.analysis).toBe(LOCALIZER.key);
    });

    it('selects and unselects points of the focused analysis, and analyses for a merge', () => {
        const store = open();
        store.getState().togglePoint(1);
        store.getState().togglePoint(0);
        expect(store.getState().coordinates?.selected).toEqual([0, 1]);
        store.getState().togglePoint(1);
        expect(store.getState().coordinates?.selected).toEqual([0]);
        store.getState().toggleMerge(HOUSES.key);
        store.getState().toggleMerge();
        expect(store.getState().merging).toEqual([HOUSES.key, FACES.key]);
        store.getState().moveAnalysis(1);
        expect(store.getState().coordinates?.selected).toEqual([]);
        expect(store.getState().merging).toEqual([HOUSES.key, FACES.key]);
    });

    it('leaves the coordinates for a record item focused, and comes back on the step', () => {
        const store = open();
        store.getState().focusEntity('study');
        expect(store.getState().coordinates).toBeNull();
        store.getState().setStep('analyses');
        store.getState().setStep('coordinates');
        expect(store.getState().coordinates?.analysis).toBe(FACES.key);
    });

    it('takes a text point’s span in UTF-16, as the text has it', () => {
        const text = `😀 ${COORD_TEXT}`;
        const at = span('x = 4, y = -60, z = 40');
        const shifted = { start_char: at.start_char + 2, end_char: at.end_char + 2 };
        const bundle = coordinateBundle({
            text,
            coordinate_parse: {
                analyses: [
                    {
                        ...LOCALIZER,
                        text_spans: [shifted],
                        points: [{ coordinates: [4, -60, 40], text_span: shifted }],
                    },
                ],
            },
        });
        const store = createReviewStore(bundle);
        expect(store.getState().focusedSpans).toEqual([
            [fromCodePoints(text, shifted.start_char), fromCodePoints(text, shifted.end_char)],
        ]);
    });
    it('takes the revision’s spans in UTF-16, as the text has them', () => {
        const text = `😀 ${COORD_TEXT}`;
        const at = span('x = 4, y = -60, z = 40');
        const shifted = { start_char: at.start_char + 2, end_char: at.end_char + 2 };
        const bundle = coordinateBundle({
            text,
            coordinate_revision: revision([
                { ...LOCALIZER, text_spans: [shifted], points: [{ coordinates: [4, -60, 40], text_span: shifted }] },
            ]),
        });
        const store = createReviewStore(bundle);
        store.getState().focusAnalysis(LOCALIZER.key);
        expect(store.getState().focusedSpans).toEqual([
            [fromCodePoints(text, shifted.start_char), fromCodePoints(text, shifted.end_char)],
        ]);
    });
});

describe('after a coordinate result', () => {
    const accept: Op = {
        client_op_id: 'c-1',
        type: 'coordinate',
        target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
        action: 'edit_points',
        payload: { points: [PRECUNEUS] },
    };

    it('shows the result’s revision and keeps focus on the analysis that replaced the focused one', () => {
        const store = open();
        store.getState().focusAnalysis(FACES.key, 1);
        store.getState().togglePoint(1);
        store.getState().emit(accept);
        expect(store.getState().pending).toEqual([accept]);
        const edited = { ...FACES, key: key(0x1a1), derived_from: [FACES.key], points: [PRECUNEUS] };
        const moved = { ...HOUSES, key: key(0x1b2), derived_from: [HOUSES.key], points: [HOUSES.points![0], INSULA] };
        const provenance = { [`coordinate_analysis:${edited.key}`]: { state: 'added', user_id: 'u1', at: 'then' } };
        store
            .getState()
            .confirm(coordinateResult([accept], [edited, moved, LOCALIZER, SCRAMBLED], { provenance }), [accept]);
        const state = store.getState();
        expect(state.pending).toEqual([]);
        expect(state.bundle.coordinate_revision).toMatchObject({ analyses: [edited, moved, LOCALIZER, SCRAMBLED] });
        expect(state.provenance).toEqual(provenance);
        expect(state.coordinates).toEqual({ analysis: edited.key, point: 0, selected: [] });
        expect(state.focusedSpans).toEqual([PRECUNEUS_ROW]);
    });

    it('focuses the next analysis when the focused one was taken away', () => {
        const store = open();
        store.getState().emit(undoingAdd('c-omit', FACES, 0));
        store.getState().confirm(coordinateResult([accept], [HOUSES, LOCALIZER, SCRAMBLED]), store.getState().pending);
        expect(store.getState().coordinates?.analysis).toBe(HOUSES.key);
    });

    it('drops analyses gone from the merge selection', () => {
        const store = open();
        store.getState().toggleMerge(HOUSES.key);
        store.getState().toggleMerge(LOCALIZER.key);
        store.getState().emit(accept);
        store.getState().confirm(coordinateResult([accept], [FACES, LOCALIZER, SCRAMBLED]), [accept]);
        expect(store.getState().merging).toEqual([LOCALIZER.key]);
    });

    it('focuses the analysis that replaced the focused one, wherever it is placed', () => {
        const store = open();
        store.getState().focusAnalysis(HOUSES.key);
        const edit: Op = {
            client_op_id: 'c-2',
            type: 'coordinate',
            target: { kind: 'coordinate_analysis', analysis_key: HOUSES.key },
            action: 'edit_points',
            payload: { points: [CUNEUS_POINT] },
        };
        const edited = { ...HOUSES, key: key(0x2b2), derived_from: [HOUSES.key], points: [CUNEUS_POINT] };
        store.getState().emit(edit);
        store.getState().confirm(coordinateResult([edit], [FACES, LOCALIZER, SCRAMBLED, edited]), [edit]);
        expect(store.getState().coordinates?.analysis).toBe(edited.key);
    });

    it('focuses the analysis now in the focused one’s place when it was taken from the middle', () => {
        const store = open();
        store.getState().focusAnalysis(HOUSES.key);
        const omit = undoingAdd('c-3', HOUSES, 1);
        store.getState().emit(omit);
        store.getState().confirm(coordinateResult([omit], [FACES, LOCALIZER, SCRAMBLED]), [omit]);
        expect(store.getState().coordinates?.analysis).toBe(LOCALIZER.key);
    });

    it('keeps the point selection of the focused analysis when its key stands', () => {
        const store = open();
        store.getState().focusAnalysis(FACES.key, 0);
        store.getState().togglePoint(1);
        const relabel: Op = {
            client_op_id: 'c-4',
            type: 'coordinate',
            target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
            action: 'relabel',
            role: 'anchor',
        };
        store.getState().emit(relabel);
        store
            .getState()
            .confirm(coordinateResult([relabel], [{ ...FACES, role: 'anchor' }, HOUSES, LOCALIZER, SCRAMBLED]), [
                relabel,
            ]);
        expect(store.getState().coordinates).toEqual({ analysis: FACES.key, point: 0, selected: [1] });
    });

    it('converts the revision’s spans from the server’s code points to UTF-16', () => {
        const text = `😀 ${COORD_TEXT}`;
        const at = span('x = 4, y = -60, z = 40');
        const shifted = { start_char: at.start_char + 2, end_char: at.end_char + 2 };
        const store = createReviewStore(coordinateBundle({ text }));
        store.getState().emit(accept);
        const moved = {
            ...LOCALIZER,
            text_spans: [shifted],
            points: [{ coordinates: [4, -60, 40] as [number, number, number], text_span: shifted }],
        };
        store.getState().confirm(coordinateResult([accept], [FACES, HOUSES, moved, SCRAMBLED]), [accept]);
        const revised = store.getState().bundle.coordinate_revision as { analyses: { text_spans?: unknown[] }[] };
        expect(revised.analyses[2].text_spans).toEqual([
            { start_char: fromCodePoints(text, shifted.start_char), end_char: fromCodePoints(text, shifted.end_char) },
        ]);
    });

    it('after a rebase, focus follows the analysis that replaced the focused one', () => {
        const store = open();
        store.getState().focusAnalysis(HOUSES.key);
        const edited = { ...HOUSES, key: key(0x2b2), derived_from: [HOUSES.key], points: [CUNEUS_POINT] };
        const fresh = coordinateBundle({ coordinate_revision: revision([FACES, edited, LOCALIZER, SCRAMBLED]) });
        store.getState().rebase({ ...fresh, ops: [] });
        expect(store.getState().coordinates?.analysis).toBe(edited.key);
    });
});

describe('a batch of ops', () => {
    it('becomes pending in one update of the store', () => {
        const store = open();
        const updates: number[] = [];
        store.subscribe((state) => updates.push(state.pending.length));
        const moves: Op[] = [
            {
                client_op_id: 'm-1',
                type: 'coordinate',
                target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
                action: 'edit_points',
                payload: { points: [INSULA] },
            },
            {
                client_op_id: 'm-2',
                type: 'coordinate',
                target: { kind: 'coordinate_analysis', analysis_key: HOUSES.key },
                action: 'edit_points',
                payload: { points: [CUNEUS_POINT, PRECUNEUS] },
            },
        ];
        expect(store.getState().emitBatch(moves)).toBe(true);
        expect(updates).toEqual([2]);
    });
});

describe('against the recorded coordinate scenarios', () => {
    const linked = linkedBundle();
    const analyses = (linked.coordinate_parse as unknown as { analyses: { key: string; name: string }[] }).analyses;
    const keyNamed = (name: string) => {
        const found = analyses.find((a) => a.name === name);
        if (!found) throw new Error(`no analysis named ${name} in the recorded bundle`);
        return found.key;
    };
    const FIRST = keyNamed('patients > controls');
    const SECOND = keyNamed('controls > patients');
    const posted = (name: string) => {
        const step = RECORDED.find((s) => s.name === name)?.steps.find((s) => s.request.method === 'POST');
        if (!step) throw new Error(`no recorded POST in ${name}`);
        return { ops: (step.request.body as { ops: Op[] }).ops, result: step.response.body as OpResult };
    };

    it('focuses the first part of a recorded split', () => {
        const { ops, result } = posted('coordinate split');
        const store = createReviewStore(linked);
        const split = ops[0] as Extract<Op, { type: 'coordinate' }>;
        store.getState().focusAnalysis((split.target as { analysis_key: string }).analysis_key, 0);
        store.getState().emit(split);
        store.getState().confirm(result, ops);
        const first = (
            result.coordinate_revision as { analyses: { key: string; derived_from?: string[] }[] }
        ).analyses.find((a) => a.derived_from?.length)!;
        expect(store.getState().coordinates).toEqual({ analysis: first.key, point: 0, selected: [] });
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().provenance).toEqual(result.provenance);
    });

    type Revised = { analyses: { key: string; name: string; derived_from?: string[] }[] };
    const replay = (name: string, focus: string) => {
        const { ops, result } = posted(name);
        const store = createReviewStore(linked);
        store.getState().focusAnalysis(focus);
        for (const op of ops) store.getState().emit(op);
        store.getState().confirm(result, ops);
        return { store, revised: (result.coordinate_revision as Revised).analyses, result };
    };

    it('keeps focus on the source of a recorded move, the record and entities from the result', () => {
        const { store, revised, result } = replay('coordinate move, one batch of two point edits', SECOND);
        const source = revised.find((a) => a.derived_from?.includes(SECOND))!;
        expect(store.getState().coordinates?.analysis).toBe(source.key);
        expect(store.getState().bundle.entities).toEqual(result.entities);
        expect(store.getState().pending).toEqual([]);
    });

    it('focuses the merged analysis of a recorded merge', () => {
        const { store, revised } = replay('coordinate merge', FIRST);
        const merged = revised.find((a) => a.derived_from?.includes(FIRST) && a.derived_from.includes(SECOND))!;
        expect(store.getState().coordinates?.analysis).toBe(merged.key);
    });

    it('focuses the analysis a recorded add made', () => {
        const { store, revised } = replay('coordinate add', FIRST);
        expect(store.getState().coordinates?.analysis).toBe(revised.at(-1)!.key);
    });

    it('takes a note on a part a recorded split made, at once', () => {
        const { store, revised } = replay('coordinate split', SECOND);
        const part = revised.find((a) => a.derived_from?.includes(SECOND))!;
        const note: Op = {
            client_op_id: 'note-part-1',
            type: 'note',
            target: { kind: 'coordinate_analysis', analysis_key: part.key },
            note: 'one contrast',
        };
        const notices = store.getState().notices;
        expect(store.getState().emit(note)).toBe(true);
        expect(store.getState().pending).toEqual([note]);
        expect(store.getState().notices).toBe(notices);
    });
});
