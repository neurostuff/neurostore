import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReviewBundle } from '../contract/generated/review-bundle';

export const LINKED_SCENARIO = 'the bundle of the linked-analyses record';

interface RecordedScenario {
    name: string;
    steps: { request: { method: string; path: string; body: unknown }; response: { status: number; body: unknown } }[];
}

export const RECORDED: RecordedScenario[] = JSON.parse(
    readFileSync(path.resolve(__dirname, 'golden/op-scenarios.json'), 'utf8')
);

/** The scenario whose first bundle is the golden source as the backend recorded it, before any review. */
export const SOURCE_SCENARIO = 'bundle without a review, then with one';

/** The bundle the backend answered `scenario`'s first GET with, with the fake server's ids in place of its placeholders. */
export function recordedBundle(scenario: string): ReviewBundle {
    const step = RECORDED.find((s) => s.name === scenario)!.steps.find((s) => s.request.method === 'GET')!;
    const ids: [string, string][] = [
        ['<source_id>', 'golden-1'],
        ['<base_study_id>', 'golden-base-1'],
        ['<review_id>', 'review-1'],
    ];
    const text = ids.reduce(
        (json, [placeholder, real]) => json.replaceAll(placeholder, real),
        JSON.stringify(step.response.body)
    );
    return JSON.parse(text) as ReviewBundle;
}

/** The bundle the backend recorded for the linked-analyses scenario. */
export const linkedBundle = () => recordedBundle(LINKED_SCENARIO);
