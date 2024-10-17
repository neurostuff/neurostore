import { IStoreAnalysis } from 'pages/Study/store/StudyStore.helpers';

export const hasDuplicateStudyAnalysisNames = (
    analyses: IStoreAnalysis[]
): { errorMessage: string; isError: boolean } => {
    const set = new Set();
    for (let i = 0; i < analyses.length; i++) {
        const analysis = analyses[i];

        if (set.has(analysis.name)) {
            return {
                errorMessage: `Duplicate analysis name: ${analysis.name}. Please give your analyses unique names and try again.`,
                isError: true,
            };
        } else {
            set.add(analysis.name);
        }
    }
    return {
        errorMessage: '',
        isError: false,
    };
};

export const hasEmptyStudyPoints = (
    analyses: IStoreAnalysis[]
): { errorMessage: string; isError: boolean } => {
    for (let i = 0; i < analyses.length; i++) {
        const analysis = analyses[i];
        const isDefaultSinglePoint =
            analysis.points.length === 1 &&
            analysis.points.every(
                ({ x, y, z, subpeak, value, cluster_size }) =>
                    x === undefined &&
                    y === undefined &&
                    z === undefined &&
                    subpeak === undefined &&
                    cluster_size === undefined
            );
        if (isDefaultSinglePoint) continue;

        const hasEmptyPoint = analysis.points.some(
            (xyz) => xyz.x === undefined || xyz.y === undefined || xyz.z === undefined
        );
        if (hasEmptyPoint)
            return {
                errorMessage: `Analysis ${analysis.name} has empty coordinates. Please add coordinatesa and try again.`,
                isError: true,
            };
    }
    return {
        errorMessage: '',
        isError: false,
    };
};
