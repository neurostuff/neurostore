import { act } from '@testing-library/react';
import { currentAnalyses } from '../model/coordinates';
import { hasFixture, loadFixture } from '../test/bundles';
import { registeredSpans } from '../test/highlights';
import { renderWithStore } from '../test/render';
import { ReviewScreen } from './ReviewScreen';
import { buildPaletteIndex, searchPalette } from './search';

const BUDGET_MS = 100;
// A first coordinate focus builds a range for every point; jsdom builds each in about 5 ms where a
// browser takes well under one, so this guards against regressions and N2 is checked in a browser.
const FIRST_COORDINATE_FOCUS_MS = 200;
const RUNS = 5;
const HEAVY = '25Czf8TcaxDS';
const RENDER_TIMEOUT_MS = 30_000;
const KEYSTROKE_BUDGET_MS = 50;

function timed(focus: () => void) {
    const started = performance.now();
    act(focus);
    return performance.now() - started;
}

const median = (timings: number[]) => [...timings].sort((a, b) => a - b)[Math.floor(timings.length / 2)];

function open(id: string) {
    const view = renderWithStore(<ReviewScreen />, loadFixture(id));
    const { index } = view.store.getState();
    const slots = index.visible.flatMap((e) => e.slots).filter((s) => s.spans.length > 0);
    return { ...view, index, slots };
}

describe.each(['22fv2dADxHqR', HEAVY])('focus performance on %s', (id) => {
    it.skipIf(!hasFixture(id))(
        `updates the highlights within ${BUDGET_MS} ms of focusing a slot`,
        () => {
            const { store, textRoot, slots } = open(id);
            act(() => store.getState().focusSlot(slots[slots.length - 1].key));
            const timings = slots.slice(0, RUNS).map((slot) => {
                const elapsed = timed(() => store.getState().focusSlot(slot.key));
                expect(registeredSpans('rv-focus', textRoot())).toEqual(slot.spans);
                return elapsed;
            });
            expect(median(timings)).toBeLessThan(BUDGET_MS);
        },
        RENDER_TIMEOUT_MS
    );
});

describe.skipIf(!hasFixture(HEAVY))(`focus performance on ${HEAVY}’s heaviest items`, () => {
    it(
        `focuses an entity, highlighting all its slots’ spans, within ${BUDGET_MS} ms`,
        () => {
            const { store, textRoot, index } = open(HEAVY);
            const entities = [...index.visible].sort((a, b) => b.spans.length - a.spans.length).slice(0, RUNS);
            const timings = entities.map((entity) => {
                const elapsed = timed(() => store.getState().focusEntity(entity.id));
                expect(registeredSpans('rv-focus', textRoot())).toEqual(entity.spans);
                return elapsed;
            });
            expect(median(timings)).toBeLessThan(BUDGET_MS);
        },
        RENDER_TIMEOUT_MS
    );

    it(
        `focuses each of the ${RUNS} analyses with the most points, first in the coordinates step, within ${FIRST_COORDINATE_FOCUS_MS} ms in jsdom`,
        () => {
            const { store } = open(HEAVY);
            expect(store.getState().step).toBe('coordinates');
            const analyses = [...currentAnalyses(store.getState().bundle)]
                .sort((a, b) => (b.points?.length ?? 0) - (a.points?.length ?? 0))
                .slice(0, RUNS);
            const timings = analyses.map((analysis) => {
                const elapsed = timed(() => store.getState().focusAnalysis(analysis.key));
                expect(store.getState().coordinates?.analysis).toBe(analysis.key);
                return elapsed;
            });
            expect(median(timings)).toBeLessThan(FIRST_COORDINATE_FOCUS_MS);
        },
        RENDER_TIMEOUT_MS
    );

    it(
        `focuses each of the 3 slots with the most spans within ${BUDGET_MS} ms`,
        () => {
            const { store, textRoot, slots } = open(HEAVY);
            const heaviest = [...slots].sort((a, b) => b.spans.length - a.spans.length).slice(0, 3);
            const elsewhere = slots[slots.length - 1];
            for (const slot of heaviest) {
                const timings = Array.from({ length: RUNS }, () => {
                    act(() => store.getState().focusSlot(elsewhere.key));
                    return timed(() => store.getState().focusSlot(slot.key));
                });
                expect(registeredSpans('rv-focus', textRoot())).toEqual(slot.spans);
                expect(median(timings), `${slot.key}, ${slot.spans.length} spans`).toBeLessThan(BUDGET_MS);
            }
        },
        RENDER_TIMEOUT_MS
    );
});

describe.skipIf(!hasFixture(HEAVY))(`command palette on ${HEAVY}`, () => {
    it(
        `answers each keystroke of a search within ${KEYSTROKE_BUDGET_MS} ms`,
        () => {
            const { store } = open(HEAVY);
            const { index, bundle } = store.getState();
            const palette = buildPaletteIndex(index, bundle.text);
            const names = index.visible
                .map((e) => e.name)
                .filter((name) => name.length > 2)
                .slice(0, RUNS);
            const queries = names.flatMap((name) =>
                Array.from({ length: name.length }, (_, i) => name.slice(0, i + 1))
            );
            const timings = queries.map((query) => {
                const started = performance.now();
                searchPalette(palette, query);
                return performance.now() - started;
            });
            expect(Math.max(...timings), `${palette.entries.length} entries`).toBeLessThan(KEYSTROKE_BUDGET_MS);
        },
        RENDER_TIMEOUT_MS
    );
});
