import { mergeAnalyses } from './merge';
import type { DraftAnalysis } from './types';

const analysis = (key: string, ...xs: number[]): DraftAnalysis => ({
    key,
    name: key,
    description: null,
    points: xs.map((x) => ({ x, y: 0, z: 0, space: 'MNI' })),
});

test('merging keeps the first selected analysis and gathers everyone’s points', () => {
    const merged = mergeAnalyses([analysis('a', 1), analysis('b', 2), analysis('c', 3)], [2, 0]);
    expect(merged.map((a) => a.key)).toEqual(['a', 'b']);
    expect(merged[0].points.map((p) => p.x)).toEqual([1, 3]);
});

test('merging fewer than two analyses changes nothing', () => {
    const analyses = [analysis('a', 1)];
    expect(mergeAnalyses(analyses, [0])).toBe(analyses);
});
