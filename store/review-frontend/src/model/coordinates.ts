export interface CoordinateParse {
    analyses?: { key: string }[];
}

/** The analysis of the original coordinate parse with `key`; throws when there is none. */
export function originalAnalysis(parse: CoordinateParse | null | undefined, key: string) {
    const analysis = (parse?.analyses ?? []).find((candidate) => candidate.key === key);
    if (!analysis) throw new Error(`the coordinate parse has no analysis '${key}'`);
    return analysis;
}
