import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { ReviewScreen } from '../review/ReviewScreen';
import { fakeServer } from '../test/fakeServer';
import { problemsWithCreated } from '../test/recordProblems';
import { renderThroughServer } from '../test/render';
import { relationshipKey } from '../model/targetKey';
import { selectStepProgress } from '../review/stepCount';
import { acceptTarget } from './actions';

vi.setConfig({ testTimeout: 30_000 });

const golden: ReviewBundle = JSON.parse(readFileSync(path.resolve(__dirname, '../test/golden/bundle.json'), 'utf8'));
const bundle: ReviewBundle = { ...golden, review: null, ops: [], reviewers: [] };
const GOLDEN_ANALYSES = golden.entities.filter((e) => e.entity_class === 'Analysis').map((e) => e.local_id);

async function open() {
    const server = fakeServer([bundle], { createdProblems: problemsWithCreated });
    const view = await renderThroughServer(<ReviewScreen />, server, bundle.source.id);
    const saved = () => waitFor(() => expect(view.stores.session.getState().pending).toEqual([]), { timeout: 10_000 });
    const analyses = () => view.stores.session.getState().bundle.entities.filter((e) => e.entity_class === 'Analysis');
    return { ...view, saved, analyses };
}

describe('creating an entity through a server that validates it', () => {
    it('adds the new analysis New analysis makes, with no banner', async () => {
        const { stores, saved, analyses, client } = await open();
        act(() => stores.view.getState().focusEntity('an_1'));
        fireEvent.click(screen.getByRole('button', { name: 'New analysis' }));
        await saved();
        expect(analyses()).toHaveLength(GOLDEN_ANALYSES.length + 1);
        expect(screen.queryByText(/Couldn’t/)).not.toBeInTheDocument();
        client.stop();
    });

    it('refuses an analysis missing what the schema requires, saying so on one line', async () => {
        const { stores, saved, analyses, client } = await open();
        act(
            () =>
                void stores.session.getState().emit({
                    client_op_id: 'broken-create',
                    type: 'create_entity',
                    parent: 'study',
                    list: 'analyses',
                    entity: {},
                })
        );
        await saved();
        expect(analyses()).toHaveLength(GOLDEN_ANALYSES.length);
        const notice = (await screen.findByText('Couldn’t add the analysis')).closest('ul')!;
        const lines = within(notice).getAllByRole('listitem');
        expect(lines).toHaveLength(1);
        expect(lines[0]).toHaveTextContent(
            /^Couldn’t add the analysis: the server needs name, .*measure.*model estimation\./
        );
        client.stop();
    });

    it('leaves the new analysis’s measure and model estimation links unchecked, and the measure’s own verdict as it was', async () => {
        const { stores, saved, analyses, client } = await open();
        act(() => void acceptTarget(stores, { kind: 'entity', entity: 'msr_1' }));
        await saved();
        const session = () => stores.session.getState();
        const measureVerdict = session().provenance['entity:msr_1'];
        expect(measureVerdict).toMatchObject({ state: 'verified' });
        const before = selectStepProgress(session(), 'relationships');
        act(() => stores.view.getState().focusEntity('an_1'));
        fireEvent.click(screen.getByRole('button', { name: 'New analysis' }));
        await saved();
        const created = analyses().find((e) => !GOLDEN_ANALYSES.includes(e.local_id))!.local_id;
        expect(session().provenance[relationshipKey(created, 'measure', 'msr_1')]).toBeUndefined();
        expect(session().provenance[relationshipKey(created, 'model_estimation', 'mdl_1')]).toBeUndefined();
        const after = selectStepProgress(session(), 'relationships');
        expect([after.done, after.total]).toEqual([before.done, before.total + 2]);
        expect(session().provenance['entity:msr_1']).toEqual(measureVerdict);
        client.stop();
    });
});
