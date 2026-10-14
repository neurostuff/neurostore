import { act } from '@testing-library/react';
import { hasFixture, loadFixture } from '../test/bundles';
import { registeredSpans } from '../test/highlights';
import { renderWithStore } from '../test/render';
import { ReviewScreen } from './ReviewScreen';

const BUDGET_MS = 100;
const RUNS = 5;
const HEAVY = '25Czf8TcaxDS';
const RENDER_TIMEOUT_MS = 30_000;

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
    it.skipIf(!hasFixture(id))(`updates the highlights within ${BUDGET_MS} ms of focusing a slot`, () => {
        const { store, textRoot, slots } = open(id);
        act(() => store.getState().focusSlot(slots[slots.length - 1].key));
        const timings = slots.slice(0, RUNS).map((slot) => {
            const elapsed = timed(() => store.getState().focusSlot(slot.key));
            expect(registeredSpans('rv-focus', textRoot())).toEqual(slot.spans);
            return elapsed;
        });
        expect(median(timings)).toBeLessThan(BUDGET_MS);
    }, RENDER_TIMEOUT_MS);
});

describe.skipIf(!hasFixture(HEAVY))(`focus performance on ${HEAVY}’s heaviest items`, () => {
    it(`focuses an entity, highlighting all its slots’ spans, within ${BUDGET_MS} ms`, () => {
        const { store, textRoot, index } = open(HEAVY);
        const entities = [...index.visible].sort((a, b) => b.spans.length - a.spans.length).slice(0, RUNS);
        const timings = entities.map((entity) => {
            const elapsed = timed(() => store.getState().focusEntity(entity.id));
            expect(registeredSpans('rv-focus', textRoot())).toEqual(entity.spans);
            return elapsed;
        });
        expect(median(timings)).toBeLessThan(BUDGET_MS);
    }, RENDER_TIMEOUT_MS);

    it(`focuses each of the 3 slots with the most spans within ${BUDGET_MS} ms`, () => {
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
    }, RENDER_TIMEOUT_MS);
});
