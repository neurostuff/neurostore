import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReviewBundle } from '../../contract/generated/review-bundle';
import type { Op } from '../../contract/generated/review-ops';
import { httpApi } from '../../api/httpApi';
import { ApiError, type ReviewApi, type ReviewLifecycle } from '../../api/reviewApi';
import { validateBundle } from '../schemas';
import { json, fakeFetch } from '../fakeFetch';
import { API_BASE, responseProblems } from '../spec';
import { fakeServer } from '../fakeServer';
import { LINKED_SCENARIO, linkedBundle } from '../linked';

interface Step {
    request: { method: string; path: string; body: unknown };
    response: { status: number; body: unknown };
}

interface Scenario {
    name: string;
    steps: Step[];
}

const SCENARIOS: Scenario[] = JSON.parse(readFileSync(path.resolve(__dirname, 'op-scenarios.json'), 'utf8'));
const GOLDEN: ReviewBundle = JSON.parse(readFileSync(path.resolve(__dirname, 'bundle.json'), 'utf8'));
const OTHER: ReviewBundle = {
    ...GOLDEN,
    source: { ...GOLDEN.source, id: 'other-1', base_study_id: 'other-base-1', label: 'Another paper' },
};

const REAL_TO_PLACEHOLDER: [string, string][] = [
    ['golden-1', '<source_id>'],
    ['golden-base-1', '<base_study_id>'],
    ['other-1', '<other_source_id>'],
    ['other-base-1', '<other_base_study_id>'],
    ['review-1', '<review_id>'],
];
const PLACEHOLDER_TO_REAL = new Map(REAL_TO_PLACEHOLDER.map(([real, placeholder]) => [placeholder, real]));
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** Maps real ids to the golden file's placeholders, and every timestamp and request id to theirs. */
function normalise(value: unknown, key = ''): unknown {
    if (key === 'request_id') return '<request_id>';
    if (typeof value === 'string') {
        if (ISO.test(value)) return '<iso>';
        return REAL_TO_PLACEHOLDER.reduce((text, [real, placeholder]) => text.replace(real, placeholder), value);
    }
    if (Array.isArray(value)) return value.map((item) => normalise(item));
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalise(v, k)]));
    return value ?? null;
}

/** The golden file's placeholders back to the real ids the fake server holds. */
const toReal = (text: string) =>
    text.replace(/<[a-z_]+>/g, (placeholder) => PLACEHOLDER_TO_REAL.get(placeholder) ?? placeholder);

const pageSizeless = (text: string) => text.replace(/page_size=\d+/, 'page_size=<page_size>');

/** Steps the client never sends: the server answers them, but no ReviewApi call makes them. */
const serverOnly = (step: Step) =>
    step.request.method === 'GET' && /^\/api\/review\/reviews\/[^/]+$/.test(step.request.path);

/** The ReviewApi call that makes a recorded request, or null for a listing page the first page's call already made. */
function callFor(api: ReviewApi, step: Step, listed: boolean): (() => Promise<unknown>) | null {
    const { method, path: recorded } = step.request;
    const [route] = toReal(recorded).split('?');
    const sourceId = route.match(/\/sources\/([^/]+)\//)?.[1];
    const reviewId = route.match(/\/reviews\/([^/]+)/)?.[1];
    if (method === 'GET' && route === '/api/review/sources/') return listed ? null : () => api.listPapers();
    if (method === 'PUT' && sourceId) return () => api.startReview(sourceId);
    if (method === 'GET' && sourceId) return () => api.getBundle(sourceId);
    if (method === 'POST' && reviewId) {
        const { expected_last_seq, ops } = step.request.body as { expected_last_seq: number; ops: Op[] };
        return () => api.postOps(reviewId, expected_last_seq, ops);
    }
    if (method === 'PATCH' && reviewId)
        return () => api.setState(reviewId, (step.request.body as { state: ReviewLifecycle }).state);
    throw new Error(`no ReviewApi call makes ${method} ${recorded}`);
}

describe('the client against the recorded requests', () => {
    it.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))('%s', async (_name, scenario) => {
        const steps = scenario.steps.filter((step) => !serverOnly(step));
        const replies = steps.map((step) => step.response);
        const served = fakeFetch(() => {
            const reply = replies.shift()!;
            return json(reply.body, reply.status);
        });
        const api = httpApi(API_BASE, async () => 'token-1', served.fetch);
        let listed = false;
        for (const step of steps) {
            const call = callFor(api, step, listed);
            if (call === null) continue;
            if (step.request.path.startsWith('/api/review/sources/?')) listed = true;
            await call().catch((error: unknown) => {
                if (!(error instanceof ApiError)) throw error;
            });
        }
        const sent = served.requests.map((r) => ({
            method: r.method,
            path: pageSizeless(normalise(new URL(r.url).pathname + new URL(r.url).search) as string),
            body: normalise(r.body ?? null),
        }));
        expect(sent).toEqual(
            steps.map((step) => ({
                method: step.request.method,
                path: pageSizeless(step.request.path),
                body: normalise(step.request.body ?? null),
            }))
        );
    });
});

/** Scenarios the test server does not reproduce yet, and why; each stays a todo until it does. */
const GAPS: Record<string, string> = {
    'bundle without a review, then with one': 'the recorded source hides an_2, which bundle.json does not',
    'fresh batch':
        'verdict, link and coordinate ops are not applied by the test server, nor its before, after or provenance',
    'full replay':
        'verdict, link and coordinate ops are not applied by the test server, nor its before, after or provenance',
    'partial replay': 'verdict ops are not applied by the test server, nor its before and after',
    'stale expected_last_seq behind': 'verdict ops are not applied by the test server',
    'link reaches a hidden entity': 'link ops and the hidden set are not modelled by the test server',
    'verdict accept of a coordinate analysis': 'verdict ops are not applied by the test server',
    'create an entity with a client local id, then set a value on it':
        'structural ops are applied by the server only (D49), not by the test server',
    'create an entity the server mints an id for':
        'structural ops are applied by the server only (D49), not by the test server',
    'create a term under a model estimation with a client local id':
        'structural ops are applied by the server only (D49), not by the test server',
    'link an analysis to an assessment of the record':
        'structural ops are applied by the server only (D49), not by the test server',
    'delete a group that an analysis still references':
        'structural ops are applied by the server only (D49), not by the test server',
    'merge an assessment into another, then undo the merge':
        'link, unlink and structural ops are applied by the server only (D49), not by the test server',
    'refused batch with two failing ops': 'the 422 messages are the backend’s, not the test server’s',
    'refused batch, op 1 fails after op 0 would apply': 'the 422 messages are the backend’s, not the test server’s',
    'refused batch, op 1 leaves an invalid document': 'the 422 message is the backend’s, not the test server’s',
    'batch the spec refuses': 'the 400 messages are the spec validator’s, not the test server’s',
    'no token': 'the test server does not check the Authorization header',
    'not an admin-reviewer': 'the test server has no role model',
    'reference by a non-admin': 'the test server has no role model',
    'batch by a non-owner': 'the test server has no owner check',
};

/** Replays a scenario's requests against a fresh test server, keeping each answer. */
async function answersOf(scenario: Scenario) {
    const seeded = scenario.name === LINKED_SCENARIO ? linkedBundle() : GOLDEN;
    const server = fakeServer([OTHER, seeded], { userId: 'user1-id' });
    const answers: { url: string; method: string; status: number; body: unknown }[] = [];
    for (const step of scenario.steps) {
        const url = `${API_BASE}${toReal(step.request.path).replace(/^\/api/, '')}`;
        const init = {
            method: step.request.method,
            headers: { Authorization: 'Bearer token-1' },
            body: step.request.body === null ? undefined : JSON.stringify(step.request.body),
        };
        const response = await server.fetch(url, init);
        answers.push({
            url,
            method: step.request.method,
            status: response.status,
            body: await response.json().catch(() => null),
        });
    }
    return answers;
}

const SERVER_APPLIED = 'coordinate ops are applied by the server only (D57), not by the test server';

/** Whether a scenario posts a coordinate op, which only the server applies. */
const postsCoordinateOp = (scenario: Scenario) =>
    scenario.steps.some(
        (step) =>
            step.request.method === 'POST' &&
            ((step.request.body as { ops?: Op[] } | null)?.ops ?? []).some((op) => op.type === 'coordinate')
    );

/** Why the test server does not reproduce a scenario, or undefined when it does. */
const gapOf = (scenario: Scenario) => GAPS[scenario.name] ?? (postsCoordinateOp(scenario) ? SERVER_APPLIED : undefined);

describe('the test server against the recorded responses', () => {
    const reproduced = SCENARIOS.filter((scenario) => gapOf(scenario) === undefined);
    it.each(reproduced.map((scenario) => [scenario.name, scenario] as const))('%s', async (_name, scenario) => {
        const answers = await answersOf(scenario);
        expect(answers.map(({ status, body }) => ({ status, body: normalise(body) }))).toEqual(
            scenario.steps.map((step) => ({ status: step.response.status, body: normalise(step.response.body) }))
        );
    });
    for (const scenario of SCENARIOS) {
        const why = gapOf(scenario);
        if (why !== undefined) it.todo(`${scenario.name}: ${why}`);
    }
});

describe('every test-server answer is valid under the spec and the bundle schema', () => {
    it.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))('%s', async (_name, scenario) => {
        const problems: string[] = [];
        for (const { url, method, status, body } of await answersOf(scenario)) {
            problems.push(...responseProblems(method, url, status, body));
            if (method === 'GET' && status === 200 && /\/bundle$/.test(url) && !validateBundle(body))
                problems.push(`bundle at ${url}: ${JSON.stringify(validateBundle.errors)}`);
        }
        expect(problems).toEqual([]);
    });
});
