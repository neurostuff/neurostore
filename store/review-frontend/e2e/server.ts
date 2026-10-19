import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { ApiError, type ReviewLifecycle, type SetAside } from '../src/api/reviewApi';
import type { ReviewBundle } from '../src/contract/generated/review-bundle';
import type { Op } from '../src/contract/generated/review-ops';
import { setSchemas } from '../src/contract/schemas';
import { memoryBackend, type MemoryOptions, type OpBatch } from '../src/test/memoryBackend';
import { E2E_API } from './api';

const file = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const bundleOf = (id: string): ReviewBundle => file(`./fixtures/${id}.bundle.json`);
const schemaOf = (name: string) => file(`../src/test/golden/schemas/${name}.schema.json`);

type Answer = { status: number; body: unknown };

/**
 * Answers the app's API requests from a memory backend over the fixture bundles, as the test server does in the
 * unit tests, and keeps the op batches it is sent; `createdProblems` as memoryBackend takes it.
 */
export async function serve(page: Page, { createdProblems }: Pick<MemoryOptions, 'createdProblems'> = {}) {
    setSchemas({
        'extraction-record': schemaOf('extraction-record'),
        'coordinate-parse': schemaOf('coordinate-parse'),
    });
    const backend = memoryBackend(async (id) => bundleOf(id), { createdProblems });
    const batches: Op[][] = [];

    async function answer(method: string, path: string, body: unknown): Promise<Answer> {
        let m;
        if (method === 'GET' && (m = path.match(/^\/review\/schemas\/([^/]+)$/)))
            return { status: 200, body: schemaOf(decodeURIComponent(m[1])) };
        if (method === 'GET' && path === '/review/me') return { status: 200, body: { user_id: 'me', name: 'Me' } };
        if (method === 'GET' && path === '/review/reviewers/')
            return { status: 200, body: { results: [{ user_id: 'me', name: 'Me' }] } };
        if (method === 'GET' && (m = path.match(/^\/review\/sources\/([^/]+)\/bundle$/)))
            return { status: 200, body: await backend.getBundle(decodeURIComponent(m[1])) };
        if (method === 'PUT' && (m = path.match(/^\/review\/sources\/([^/]+)\/review$/))) {
            const { summary, created } = await backend.startReview(decodeURIComponent(m[1]));
            return { status: created ? 201 : 200, body: summary };
        }
        if (method === 'POST' && (m = path.match(/^\/review\/reviews\/([^/]+)\/ops$/))) {
            batches.push((body as OpBatch).ops);
            return { status: 200, body: backend.postOps(decodeURIComponent(m[1]), body as OpBatch) };
        }
        if (method === 'PATCH' && (m = path.match(/^\/review\/reviews\/([^/]+)$/))) {
            const { state, reason, note } = body as {
                state: ReviewLifecycle;
                reason?: SetAside['reason'];
                note?: string;
            };
            return { status: 200, body: backend.setState(decodeURIComponent(m[1]), state, reason, note) };
        }
        return { status: 404, body: { status: 404, detail: `no route for ${method} ${path}` } };
    }

    await page.route(`**${E2E_API}/**`, async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.slice(E2E_API.length);
        let answered: Answer;
        try {
            answered = await answer(request.method(), path, request.postDataJSON());
        } catch (error) {
            if (!(error instanceof ApiError)) throw error;
            answered = { status: error.status, body: error.body };
        }
        await route.fulfill({ status: answered.status, json: answered.body });
    });

    return { backend, batches };
}
