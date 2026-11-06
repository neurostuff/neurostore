import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReviewBundle, StoredOp } from '../../contract/generated/review-bundle';
import type { Op } from '../../contract/generated/review-ops';
import { followerOf } from '../../model/analysisFollow';
import type { CoordinateAnalysis, CoordinateParse } from '../../model/coordinates';
import { carryEdit } from '../../store/pointEdits';
import { applyCoordinate, indexedAnalyses } from '../memoryCoordinates';

type Entry = { index: number; analysis: CoordinateAnalysis };
interface Step {
    op: Extract<Op, { type: 'coordinate' }>;
    before: Entry[];
    after: Entry[];
}

/** edit_points, split and merge as the real core stored them (store/backend test_coordinate_follow_golden.py). */
const golden: { parse: CoordinateParse; steps: Step[] } = JSON.parse(
    readFileSync(path.resolve(__dirname, 'coordinate-follow.json'), 'utf8')
);

/** The revision after each step, as the memory backend applies the golden's ops one after another. */
function memorySteps() {
    let revision: CoordinateParse = golden.parse;
    return golden.steps.map(({ op }) => {
        const was = revision.analyses ?? [];
        const step = applyCoordinate(revision, { analyses: [] }, op, golden.parse);
        revision = { ...revision, analyses: step.analyses };
        return {
            before: indexedAnalyses(was, step.analyses),
            after: indexedAnalyses(step.analyses, was),
            analyses: step.analyses,
        };
    });
}

const bundleOf = (analyses: CoordinateAnalysis[], ops: StoredOp[]) =>
    ({
        coordinate_parse: golden.parse,
        coordinate_revision: { ...golden.parse, analyses },
        ops,
    }) as unknown as ReviewBundle;

describe('edit_points, split and merge in the memory backend', () => {
    it.each(golden.steps.map((step, i) => [step.op.action, i] as const))(
        'take away and put in the analyses, with the keys, the real core does on %s',
        (_, i) => {
            const memory = memorySteps()[i];
            expect(memory.before).toEqual(golden.steps[i].before);
            expect(memory.after).toEqual(golden.steps[i].after);
        }
    );
});

describe('the follow rule through the real core’s stored ops', () => {
    const stored = golden.steps.map((step, seq): StoredOp => ({
        seq: seq + 1,
        op: step.op,
        before: { analyses: step.before },
        after: { analyses: step.after },
        user_id: 'u',
        created_at: 'then',
    }));
    const last = memorySteps().at(-1)!.analyses;
    const follower = followerOf(bundleOf(golden.parse.analyses ?? [], []), bundleOf(last, stored));
    const [first, second] = golden.parse.analyses!;
    const merged = golden.steps[2].after[0].analysis;
    const part1 = golden.steps[1].after[0].analysis;

    it('follows the edited analysis through its split to the first part and the merge that took the second', () => {
        expect(follower.follow(second.key).map((a) => a.key)).toEqual([part1.key, merged.key]);
        expect(follower.follow(first.key).map((a) => a.key)).toEqual([merged.key]);
        expect(follower.successor(second.key)).toBe(part1.key);
    });

    it('carries an edit made on the original onto the analysis now holding the point it changed', () => {
        const base = second.points!;
        const points = [base[0], { ...base[1], coordinates: [6, -8, 5] as [number, number, number] }];
        const carried = carryEdit(base, points, follower.follow(second.key));
        expect(carried).toEqual({
            kind: 'placed',
            parts: [{ key: merged.key, base: merged.points, points: [merged.points![0], points[1]] }],
        });
    });
});
