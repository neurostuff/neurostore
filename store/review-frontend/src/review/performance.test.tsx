import { act } from '@testing-library/react';
import { currentAnalyses } from '../model/coordinates';
import { selectDiff } from '../store/diffSelectors';
import { createReviewStores } from '../store/context';
import { hasFixture, loadFixture } from '../test/bundles';
import { registeredSpans } from '../test/highlights';
import { renderWithStores } from '../test/render';
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
    const view = renderWithStores(<ReviewScreen />, loadFixture(id));
    const { index } = view.stores.session.getState();
    const slots = index.visible.flatMap((e) => e.slots).filter((s) => s.spans.length > 0);
    return { ...view, index, slots };
}

describe.each(['22fv2dADxHqR', HEAVY])('focus performance on %s', (id) => {
    it.skipIf(!hasFixture(id))(
        `updates the highlights within ${BUDGET_MS} ms of focusing a slot`,
        () => {
            const { stores, textRoot, slots } = open(id);
            act(() => stores.view.getState().focusSlot(slots[slots.length - 1].key));
            const timings = slots.slice(0, RUNS).map((slot) => {
                const elapsed = timed(() => stores.view.getState().focusSlot(slot.key));
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
            const { stores, textRoot, index } = open(HEAVY);
            const entities = [...index.visible].sort((a, b) => b.spans.length - a.spans.length).slice(0, RUNS);
            const timings = entities.map((entity) => {
                const elapsed = timed(() => stores.view.getState().focusEntity(entity.id));
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
            const { stores } = open(HEAVY);
            expect(stores.view.getState().step).toBe('coordinates');
            const analyses = [...currentAnalyses(stores.session.getState().bundle)]
                .sort((a, b) => (b.points?.length ?? 0) - (a.points?.length ?? 0))
                .slice(0, RUNS);
            const timings = analyses.map((analysis) => {
                const elapsed = timed(() => stores.view.getState().focusAnalysis(analysis.key));
                expect(stores.view.getState().coordinates?.analysis).toBe(analysis.key);
                return elapsed;
            });
            expect(median(timings)).toBeLessThan(FIRST_COORDINATE_FOCUS_MS);
        },
        RENDER_TIMEOUT_MS
    );

    it(
        `focuses each of the 3 slots with the most spans within ${BUDGET_MS} ms`,
        () => {
            const { stores, textRoot, slots } = open(HEAVY);
            const heaviest = [...slots].sort((a, b) => b.spans.length - a.spans.length).slice(0, 3);
            const elsewhere = slots[slots.length - 1];
            for (const slot of heaviest) {
                const timings = Array.from({ length: RUNS }, () => {
                    act(() => stores.view.getState().focusSlot(elsewhere.key));
                    return timed(() => stores.view.getState().focusSlot(slot.key));
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
            const { stores } = open(HEAVY);
            const { index, bundle } = stores.session.getState();
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

describe.skipIf(!hasFixture(HEAVY))(`the diff against the original on ${HEAVY}`, () => {
    it(
        `computes the whole diff, the original's index included, within ${BUDGET_MS} ms`,
        () => {
            const timings = Array.from({ length: RUNS }, () => {
                const stores = createReviewStores(loadFixture(HEAVY));
                const started = performance.now();
                const diff = selectDiff(stores.session.getState());
                const elapsed = performance.now() - started;
                expect(diff.items.length).toBeGreaterThan(stores.session.getState().index.entities.length);
                return elapsed;
            });
            expect(median(timings)).toBeLessThan(BUDGET_MS);
        },
        RENDER_TIMEOUT_MS
    );

    it(
        `turns the diff on and off on the heaviest entity within ${BUDGET_MS} ms`,
        () => {
            const { stores, textRoot, index } = open(HEAVY);
            const [heaviest] = [...index.visible].sort((a, b) => b.spans.length - a.spans.length);
            act(() => stores.view.getState().focusEntity(heaviest.id));
            act(() => stores.view.getState().toggleDiff(true));
            act(() => stores.view.getState().toggleDiff(false));
            const timings = Array.from({ length: RUNS * 2 }, () => timed(() => stores.view.getState().toggleDiff()));
            expect(stores.view.getState().diffOn).toBe(false);
            expect(registeredSpans('rv-focus', textRoot())).toEqual(heaviest.spans);
            expect(median(timings)).toBeLessThan(BUDGET_MS);
        },
        RENDER_TIMEOUT_MS
    );

    it(
        `steps between changes with J and K within ${BUDGET_MS} ms`,
        () => {
            const bundle = loadFixture(HEAVY);
            let edits = 0;
            const rename = (node: unknown): void => {
                if (edits >= 40 || typeof node !== 'object' || node === null) return;
                const item = node as Record<string, unknown>;
                const name = item.name as { value?: unknown } | undefined;
                if (typeof item.local_id === 'string' && typeof name?.value === 'string') {
                    name.value = `${name.value} (edited)`;
                    edits += 1;
                }
                Object.values(item).forEach(rename);
            };
            rename(bundle.record);
            const stores = createReviewStores(bundle);
            stores.view.getState().toggleDiff(true);
            const keys = new Set<string>();
            const step = (delta: 1 | -1) =>
                timed(() => {
                    stores.view.getState().moveChange(delta);
                    keys.add(stores.view.getState().focus.key);
                });
            const timings = [
                ...Array.from({ length: RUNS * 4 }, () => step(1)),
                ...Array.from({ length: RUNS }, () => step(-1)),
            ];
            expect(keys.size).toBeGreaterThan(RUNS);
            expect(median(timings)).toBeLessThan(BUDGET_MS);
            expect(Math.max(...timings)).toBeLessThan(BUDGET_MS * 3);
        },
        RENDER_TIMEOUT_MS
    );
});
