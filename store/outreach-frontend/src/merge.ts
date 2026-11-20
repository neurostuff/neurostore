import type { DraftAnalysis } from './types';

/** Merge the analyses at ``indices`` into the first of them: its name, all their points. */
export function mergeAnalyses(analyses: DraftAnalysis[], indices: number[]): DraftAnalysis[] {
    const order = [...indices].sort((a, b) => a - b);
    const [first, ...rest] = order;
    if (first === undefined || rest.length === 0) return analyses;
    const merged = { ...analyses[first], points: order.flatMap((index) => analyses[index].points) };
    return analyses.flatMap((analysis, index) => (index === first ? [merged] : rest.includes(index) ? [] : [analysis]));
}
