import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { fakeHotIn } from '@neurosynth/coordinate-table/testing';
import type { Op } from '../contract/generated/review-ops';
import { currentAnalyses, type CoordinatePoint } from '../model/coordinates';
import { ReviewScreen } from '../review/ReviewScreen';
import { createOpClient } from '../store/opClient';
import { coordinateBundle, FACES } from './coordinates';
import { json } from './fakeFetch';
import { fakeServer } from './fakeServer';
import { engageGrid } from './grid';
import { renderWithStores } from './render';

export const SLOW = { timeout: 10_000 };

/** The point with its z coordinate set to `z`. */
export const at = (point: CoordinatePoint, z: number): CoordinatePoint => ({
    ...point,
    coordinates: [point.coordinates[0], point.coordinates[1], z],
});

/**
 * The review screen on the coordinates of P1, saving through an op client to a fake server, with the grid of
 * Faces > Houses engaged. Its tests mock Handsontable with the package's stand-in.
 */
export async function openSaving() {
    const server = fakeServer([coordinateBundle({ review: null })]);
    await server.backend.startReview('P1');
    const view = renderWithStores(<ReviewScreen />, await server.backend.getBundle('P1'), { now: () => 'now' });
    const client = createOpClient(view.stores.session, server.api());
    client.start();
    await engageGrid(FACES.name);
    const hot = () => fakeHotIn(screen.getByRole('group', { name: `edit the points of ${FACES.name}` }));
    const posted = () => server.requests.filter((r) => r.method === 'POST').map((r) => (r.body as { ops: Op[] }).ops);
    const saved = () =>
        waitFor(() => {
            expect(view.stores.session.getState().pending).toEqual([]);
            expect(view.stores.session.getState().collected).toEqual([]);
        }, SLOW);
    const settled = () => waitFor(() => expect(view.stores.session.getState().pending).toEqual([]), SLOW);
    const analyses = () => currentAnalyses(view.stores.session.getState().bundle);
    const faces = () => analyses().find((a) => a.name.startsWith(FACES.name));
    /** Whether the grid takes edits: no column read-only. */
    const editable = () => (hot().props.columns ?? []).every((column) => !column.readOnly);
    /** Holds back the next op batch until the returned function is called; `respond` answers it, else the server does. */
    const hold = () => {
        let release: (respond?: (body: { ops: Op[] }) => Response) => void = () => {};
        const released = new Promise<((body: { ops: Op[] }) => Response) | undefined>((resolve) => (release = resolve));
        server.intercept(async (request) => (await released)?.(request.body as { ops: Op[] }));
        return release;
    };
    const status = () =>
        within(screen.getByRole('group', { name: `${faces()!.name}: card head` })).getByRole('status', {
            name: 'point edits',
        });
    /** Sends what is collected now and waits until the batch is out. */
    const sendOut = async (count = 1) => {
        act(() => void client.flush());
        await waitFor(() => expect(posted()).toHaveLength(count), SLOW);
    };
    return { ...view, server, client, hot, posted, saved, settled, analyses, faces, editable, hold, status, sendOut };
}

export type SavingView = Awaited<ReturnType<typeof openSaving>>;

export const headOf = () => screen.getByRole('group', { name: /: card head$/ });
export const headButton = (name: string) => within(headOf()).getByRole('button', { name });
export const enter = (target: Element) => act(() => void fireEvent.keyDown(target, { key: 'Enter' }));

/** A 422 answer refusing the batch's first op with `message`. */
export const refusing =
    (message: string) =>
    ({ ops: [op] }: { ops: Op[] }) =>
        json(
            {
                status: 422,
                title: 'Unprocessable Entity',
                detail: 'op 0 is refused',
                errors: [
                    {
                        field: 'ops/0',
                        code: 'REJECTED',
                        message,
                        context: { op_index: 0, client_op_id: op.client_op_id },
                    },
                ],
            },
            422
        );
