import { act, fireEvent } from '@testing-library/react';
import { currentAnalyses } from '../model/coordinates';
import type { SlotNode } from '../model/record';
import { selectDiff } from '../store/diffSelectors';
import { createReviewStores } from '../store/reviewStores';
import { hasFixture, loadFixture } from '../test/bundles';
import { registeredSpans } from '../test/highlights';
import { renderWithStores } from '../test/render';
import { focusedSpans } from '../test/stores';
import { auditCards } from '../model/guided';
import { comparisonOf, entriesOf, isCellSlot } from '../model/comparison';
import { SHORTCUTS } from './shortcuts';
import { ReviewScreen } from './ReviewScreen';
import { buildPaletteIndex, searchPalette } from './search';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

const BUDGET_MS = 100;
// A first coordinate focus builds a range for every point; jsdom builds each in about 5 ms where a
// browser takes well under one, so this guards against regressions and N2 is checked in a browser.
const FIRST_COORDINATE_FOCUS_MS = 200;
const RUNS = 5;
const HEAVY = '25Czf8TcaxDS';
const RENDER_TIMEOUT_MS = 30_000;
const KEYSTROKE_BUDGET_MS = 50;
// jsdom renders MUI about ten times slower than a browser; the first click also warms React up, so is not timed.
const CLICK_BUDGET_MS = 100;

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
        `focuses each of the 3 reference fields with the most referenced spans within ${BUDGET_MS} ms`,
        () => {
            const { stores, textRoot, index, slots } = open(HEAVY);
            const referenced = (slot: SlotNode) =>
                slot.references.reduce((n, id) => n + (index.entity(id)?.spans.length ?? 0), 0);
            const heaviest = index.visible
                .flatMap((e) => e.slots)
                .filter((s) => s.kind === 'reference')
                .sort((a, b) => referenced(b) - referenced(a))
                .slice(0, 3);
            expect(heaviest.length).toBeGreaterThan(0);
            const elsewhere = slots[slots.length - 1];
            for (const slot of heaviest) {
                const timings = Array.from({ length: RUNS }, () => {
                    act(() => stores.view.getState().focusSlot(elsewhere.key));
                    return timed(() => stores.view.getState().focusSlot(slot.key));
                });
                expect(registeredSpans('rv-focus', textRoot())).toEqual(focusedSpans(stores));
                expect(focusedSpans(stores).length).toBeGreaterThan(0);
                expect(median(timings), `${slot.key}, ${focusedSpans(stores).length} spans`).toBeLessThan(BUDGET_MS);
            }
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

describe.skipIf(!hasFixture(HEAVY))(`what each analysis of ${HEAVY} compares`, () => {
    it(
        `is worked out for every analysis within ${BUDGET_MS} ms`,
        () => {
            const { index } = open(HEAVY);
            const analyses = index.visible.filter((e) => e.entityClass === 'Analysis');
            const started = performance.now();
            for (const analysis of analyses) comparisonOf(index, analysis);
            expect(performance.now() - started).toBeLessThan(BUDGET_MS);
        },
        RENDER_TIMEOUT_MS
    );

    // Any focus on the Analyses step of this paper takes several hundred ms in jsdom with or without the
    // comparison, so a sign is held to what a field of the same card takes.
    it(
        `focuses a sign of each of the ${RUNS} analyses with the most cells no slower than a field of the card`,
        () => {
            const { stores, index } = open(HEAVY);
            act(() => stores.view.getState().setStep('analyses'));
            const cells = (id: string) => index.entity(id)!.slots.filter(isCellSlot).length;
            const analyses = index.visible
                .filter((e) => e.entityClass === 'Analysis')
                .sort((a, b) => cells(b.id) - cells(a.id))
                .slice(0, RUNS);
            const signs: number[] = [];
            const fields: number[] = [];
            for (const analysis of analyses) {
                act(() => stores.view.getState().focusEntity(analysis.id));
                const direction = entriesOf(comparisonOf(index, analysis).rows[0])[0].slots.direction;
                const field = analysis.slots.find((slot) => !isCellSlot(slot))!.key;
                fields.push(timed(() => stores.view.getState().focusSlot(field)));
                signs.push(timed(() => stores.view.getState().focusSlot(direction)));
                expect(document.querySelector(`button[data-slot-key="${direction}"]`)).toHaveAttribute(
                    'aria-current',
                    'true'
                );
            }
            expect(median(signs), `signs ${signs}, fields ${fields}`).toBeLessThan(median(fields) * 1.5);
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

describe('relationships step performance', () => {
    it.skipIf(!hasFixture(HEAVY))(
        `opens the step on the largest paper as fast as the analyses step, then a card on a click and each link on j within ${BUDGET_MS} ms`,
        () => {
            const { stores, textRoot } = open(HEAVY);
            const view = () => stores.view.getState();
            const cards = auditCards(stores.session.getState());
            act(() => view().setStep('relationships'));
            const analyses = timed(() => view().setStep('analyses'));
            const opened = timed(() => view().setStep('relationships'));
            const heads = document.querySelectorAll('[aria-label="relationships"] > li');
            expect(heads).toHaveLength(cards.length);
            expect(document.querySelectorAll('[role="region"][aria-label^="Links of "]')).toHaveLength(1);
            const [, second, third] = [...heads].map((head) => head.querySelector<HTMLElement>('[data-card]')!);
            act(() => void fireEvent.click(second));
            const clicked = timed(() => void fireEvent.click(third));
            expect(view().focus.entity).toBe(cards[2].analysis.id);
            const next = SHORTCUTS.find((s) => s.keys[0] === 'j' && s.scope === 'record')!;
            const timings = Array.from({ length: RUNS * 2 }, () => timed(() => next.run(stores)));
            expect(view().focus.key).toMatch(/^relationship:/);
            expect(registeredSpans('rv-focus', textRoot())).toEqual(focusedSpans(stores));
            expect(opened).toBeLessThan(analyses * 1.5);
            expect(clicked).toBeLessThan(CLICK_BUDGET_MS);
            expect(median(timings)).toBeLessThan(BUDGET_MS);
        },
        RENDER_TIMEOUT_MS
    );
});
