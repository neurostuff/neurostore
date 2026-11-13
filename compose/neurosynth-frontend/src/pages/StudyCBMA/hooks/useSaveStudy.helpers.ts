import {
    IStoreAnalysis,
    pointHasInvalidEntry,
    pointIsMissingCoordinate,
    pointIsUnset,
} from 'stores/study/StudyStore.helpers';

export const hasDuplicateStudyAnalysisNames = (
    analyses: IStoreAnalysis[]
): { errorMessage: string; isValid: boolean } => {
    const set = new Set();
    for (let i = 0; i < analyses.length; i++) {
        const analysis = analyses[i];

        if (set.has(analysis.name)) {
            return {
                errorMessage: `Duplicate analysis name: ${analysis.name}. Please give your analyses unique names and try again.`,
                isValid: false,
            };
        } else {
            set.add(analysis.name);
        }
    }
    return {
        errorMessage: '',
        isValid: true,
    };
};

// If every point is empty, the analysis is empty and we treat it as such. We raise the error
// if there is at least one point that is not empty.
export const hasMissingPointInfo = (analyses: IStoreAnalysis[]): { errorMessage: string; isValid: boolean } => {
    for (let i = 0; i < analyses.length; i++) {
        const analysis = analyses[i];
        if (analysis.points.every(pointIsUnset)) continue;

        if (analysis.points.some(pointIsMissingCoordinate))
            return {
                errorMessage: `Analysis ${analysis.name} has empty coordinates. Please add coordinates and try again.`,
                isValid: false,
            };
    }
    return {
        errorMessage: '',
        isValid: true,
    };
};

export const pointFieldsAreValidTypes = (analyses: IStoreAnalysis[]): { errorMessage: string; isValid: boolean } => {
    for (let i = 0; i < analyses.length; i++) {
        const analysis = analyses[i];
        if (analysis.points.some(pointHasInvalidEntry)) {
            return {
                errorMessage: `Analysis ${analysis.name} has a non-numeric value. X, Y, Z, value, and cluster size must be numbers.`,
                isValid: false,
            };
        }
    }
    return {
        errorMessage: '',
        isValid: true,
    };
};
