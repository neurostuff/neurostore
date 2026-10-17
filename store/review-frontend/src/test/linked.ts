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

/** The bundle the backend recorded for the linked-analyses scenario, with the fake server's ids in place of its placeholders. */
export function linkedBundle(): ReviewBundle {
    const step = RECORDED.find((s) => s.name === LINKED_SCENARIO)!.steps.find((s) => s.request.method === 'GET')!;
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
