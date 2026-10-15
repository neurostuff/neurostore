import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { httpApi } from '../api/httpApi';
import type { OpResult } from '../api/reviewApi';
import type { Op } from '../contract/generated/review-ops';
import { currentAnalyses, type CoordinateAnalysis } from '../model/coordinates';
import { createOpClient, type OpClient } from '../store/opClient';
import { fakeFetch, json } from '../test/fakeFetch';
import { linkedBundle, RECORDED } from '../test/linked';
import { renderWithStore } from '../test/render';
import { coordinateOpErrors } from '../test/schemas';
import { API_BASE } from '../test/spec';
import { ReviewScreen } from './ReviewScreen';

// These tests render the whole review screen and query it by role, which takes 1.5–3 s each in
// jsdom and more under the full parallel suite.
vi.setConfig({ testTimeout: 15_000 });

const FIRST = 'patients > controls';
const SECOND = 'controls > patients';
const keyNamed = (name: string) => {
    const found = currentAnalyses(linkedBundle()).find((a) => a.name === name);
    if (!found) throw new Error(`no analysis named ${name} in the recorded bundle`);
    return found.key;
};
const FIRST_KEY = keyNamed(FIRST);
const SECOND_KEY = keyNamed(SECOND);
const recorded = (name: string) => {
    const steps = RECORDED.find((s) => s.name === name)!.steps;
    const post = steps.find((s) => s.request.method === 'POST')!;
    return { ops: (post.request.body as { ops: Op[] }).ops, result: post.response.body as OpResult };
};

const press = (key: string, init: KeyboardEventInit = {}) =>
    act(() => void fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init }));
const card = (name: string) => screen.getByRole('article', { name });
const pointsOf = (name: string) =>
    within(screen.getByRole('grid', { name: `points of ${name}` })).getAllByRole('row').length - 1;
const cardsShown = () =>
    screen
        .getAllByRole('article')
        .map((article) => [article.getAttribute('aria-label'), pointsOf(article.getAttribute('aria-label')!)])
        .sort();
const revisedOf = (result: OpResult) => (result.coordinate_revision as { analyses: CoordinateAnalysis[] }).analyses;
const byName = (analyses: CoordinateAnalysis[]) => analyses.map((a) => [a.name, a.points?.length ?? 0]).sort();
const actionsOf = (ops: Op[]) =>
    ops.map((op) => [op.type, 'action' in op ? op.action : undefined, 'target' in op ? op.target : undefined]);

let clients: OpClient[] = [];

afterEach(() => {
    clients.forEach((client) => client.stop());
    clients = [];
});

/** The linked bundle on screen, with a save loop that sends to a fake fetch answering the recorded response. */
function open(scenario: string) {
    const view = renderWithStore(<ReviewScreen />, linkedBundle(), { now: () => 'now' });
    const answers = recorded(scenario).result;
    const served = fakeFetch(async () => json(answers, 200));
    const client = createOpClient(
        view.store,
        httpApi(API_BASE, async () => 'token-1', served.fetch)
    );
    client.start();
    clients.push(client);
    const sent = () => served.requests.filter((r) => r.method === 'POST').flatMap((r) => (r.body as { ops: Op[] }).ops);
    return { ...view, served, sent };
}

async function saved(store: ReturnType<typeof open>['store']) {
    await waitFor(() => expect(store.getState().pending).toEqual([]));
}

describe('the recorded linked-analyses bundle, driven through the screen', () => {
    it('splits the second analysis as recorded: cards, focus, notices and record from the result', async () => {
        const { store, sent } = open('coordinate split');
        const { ops, result } = recorded('coordinate split');
        fireEvent.click(card(SECOND));
        press('j');
        press(' ');
        press('s');
        await saved(store);
        expect(actionsOf(sent())).toEqual(actionsOf(ops));
        expect(coordinateOpErrors(sent())).toEqual([]);
        const revised = currentAnalyses(store.getState().bundle);
        expect(cardsShown()).toEqual(byName(revisedOf(result)));
        expect(revised.map((a) => a.key)).toEqual(revisedOf(result).map((a) => a.key));
        const first = revised.find((a) => a.derived_from?.length)!;
        expect(store.getState().coordinates?.analysis).toBe(first.key);
        expect(store.getState().notices).toEqual([
            { kind: 'split', slot: 'an_1 mirror_of', message: 'it points at an_2' },
        ]);
        expect(store.getState().bundle.hidden).toEqual(result.hidden);
        expect(store.getState().bundle.entities).toEqual(result.entities);
    });

    it('merges the analyses selected, focus on the merged one and its dangling reference as a notice', async () => {
        const { store, sent } = open('coordinate merge');
        const { ops, result } = recorded('coordinate merge');
        fireEvent.click(card(SECOND), { shiftKey: true });
        fireEvent.click(card(FIRST));
        press('g');
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Merge' }));
        await saved(store);
        expect(actionsOf(sent())).toEqual(actionsOf(ops));
        expect(coordinateOpErrors(sent())).toEqual([]);
        const revised = currentAnalyses(store.getState().bundle);
        expect(cardsShown()).toEqual(byName(revisedOf(result)));
        const merged = revised.find((a) => a.derived_from?.includes(FIRST_KEY) && a.derived_from.includes(SECOND_KEY))!;
        expect(store.getState().coordinates?.analysis).toBe(merged.key);
        expect(store.getState().notices).toEqual([
            { kind: 'dangling', slot: 'an_1 mirror_of', message: 'it points at an_2' },
        ]);
        expect(store.getState().bundle.hidden).toEqual(result.hidden);
        expect(store.getState().bundle.entities).toEqual(result.entities);
    });

    it('adds the analysis the form makes, focus on it, the record and entities from the result', async () => {
        const { store, sent } = open('coordinate add');
        const { ops, result } = recorded('coordinate add');
        const added = (ops[0] as Extract<Op, { type: 'coordinate' }>).payload as {
            analysis: { name: string; points: { coordinates: number[] }[] };
        };
        const before = new Set(currentAnalyses(store.getState().bundle).map((a) => a.key));
        fireEvent.click(card(FIRST));
        press('c');
        const form = screen.getByRole('group', { name: 'edit the first point of a new analysis in t1' });
        const [x, y, z] = added.analysis.points[0].coordinates;
        fireEvent.change(within(form).getByRole('spinbutton', { name: 'x' }), { target: { value: String(x) } });
        fireEvent.change(within(form).getByRole('spinbutton', { name: 'y' }), { target: { value: String(y) } });
        fireEvent.change(within(form).getByRole('spinbutton', { name: 'z' }), { target: { value: String(z) } });
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), {
            target: { value: added.analysis.name },
        });
        press('Enter');
        await saved(store);
        expect(actionsOf(sent())).toEqual(actionsOf(ops));
        expect(coordinateOpErrors(sent())).toEqual([]);
        const revised = currentAnalyses(store.getState().bundle);
        expect(cardsShown()).toEqual(byName(revisedOf(result)));
        expect(store.getState().coordinates?.analysis).toBe(revised.find((a) => !before.has(a.key))!.key);
        expect(store.getState().notices).toEqual([]);
        expect(store.getState().bundle.hidden).toEqual(result.hidden);
        expect(store.getState().bundle.entities).toEqual(result.entities);
    });

    it('moves the selected point as one batch of two point edits, focus on the source', async () => {
        const { store, sent } = open('coordinate move, one batch of two point edits');
        const { ops, result } = recorded('coordinate move, one batch of two point edits');
        fireEvent.click(card(SECOND));
        press('j');
        press(' ');
        press('m');
        fireEvent.change(screen.getByRole('combobox', { name: 'move 1 point to' }), { target: { value: FIRST } });
        fireEvent.click(screen.getByRole('option', { name: new RegExp(FIRST) }));
        await saved(store);
        expect(actionsOf(sent())).toEqual(actionsOf(ops));
        expect(coordinateOpErrors(sent())).toEqual([]);
        const revised = currentAnalyses(store.getState().bundle);
        expect(cardsShown()).toEqual(byName(revisedOf(result)));
        expect(store.getState().coordinates?.analysis).toBe(
            revised.find((a) => a.derived_from?.includes(SECOND_KEY))!.key
        );
        expect(store.getState().bundle.hidden).toEqual(result.hidden);
        expect(store.getState().bundle.entities).toEqual(result.entities);
    });
});
