import {
    AnalysisReturn,
    ConditionRequest,
    ConditionReturn,
    PointRequest,
    PointReturn,
} from 'neurostore-typescript-sdk';
import { IStoreAnalysis, IStoreCondition, IStorePoint } from './StudyStore';

export const studyAnalysesToStoreAnalyses = (analyses?: AnalysisReturn[]): IStoreAnalysis[] => {
    const studyAnalyses: IStoreAnalysis[] = (analyses || []).map((analysis) => {
        const parsedConditions: IStoreCondition[] = (
            (analysis.conditions || []) as ConditionReturn[]
        ).map((condition) => ({
            ...condition,
            isNew: false,
        }));

        const parsedPoints: IStorePoint[] = (analysis.points as PointReturn[]).map(
            ({ entities, ...args }) => ({
                ...args,
                x: (args.coordinates || [])[0],
                y: (args.coordinates || [])[1],
                z: (args.coordinates || [])[2],
                isNew: false,
            })
        );

        return {
            ...analysis,
            conditions: parsedConditions,
            points: parsedPoints,
            isNew: false,
        };
    });

    return (studyAnalyses || []).sort((a, b) => {
        const dateA = Date.parse(a.created_at || '');
        const dateB = Date.parse(b.created_at || '');
        if (isNaN(dateA) || isNaN(dateB)) return 0;

        return dateB - dateA;
    });
};

export const storeAnalysesToStudyAnalyses = (analyses?: IStoreAnalysis[]): AnalysisReturn[] => {
    // the backend API complains when we give an analysis ID that does not exist.
    // we therefore need to scrub the id from the analysis if it was newly created by us.
    // we also need to remove the readonly attributes and any attributes we added
    const updatedAnalyses = (analyses || []).map(
        ({ isNew, updated_at, created_at, user, conditions, points, ...args }) => {
            const scrubbedConditions: ConditionRequest[] = conditions.map(
                ({ isNew, updated_at, created_at, user, ...args }) => ({
                    ...args,
                    id: isNew ? undefined : args.id,
                })
            );

            const scrubbedPoints: PointRequest[] = points.map(
                ({ isNew, created_at, updated_at, user, coordinates, ...args }) => ({
                    ...args,
                    id: isNew ? undefined : args.id,
                })
            );
            return {
                ...args,
                conditions: scrubbedConditions,
                points: scrubbedPoints,
                id: isNew ? undefined : args.id,
            };
        }
    );

    return updatedAnalyses;
};
