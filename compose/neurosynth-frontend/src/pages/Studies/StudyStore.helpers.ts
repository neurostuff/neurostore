import {
    AnalysisReturn,
    ConditionRequest,
    ConditionReturn,
    PointReturn,
} from 'neurostore-typescript-sdk';
import { IStoreAnalysis, IStoreCondition, IStorePoint } from './StudyStore';
import { v4 as uuid } from 'uuid';

export const studyAnalysesToStoreAnalyses = (analyses?: AnalysisReturn[]): IStoreAnalysis[] => {
    const studyAnalyses: IStoreAnalysis[] = (analyses || []).map((analysis) => {
        const parsedConditions: IStoreCondition[] = (
            (analysis.conditions || []) as ConditionReturn[]
        ).map((condition) => ({
            ...condition,
            isNew: false,
        }));

        const parsedPoints: IStorePoint[] =
            (analysis?.points || []).length === 0
                ? [
                      {
                          x: undefined,
                          y: undefined,
                          z: undefined,
                          kind: '',
                          space: '',
                          isNew: true,
                          id: uuid(),
                      },
                  ]
                : (analysis.points as PointReturn[]).map((analysisPoint) => ({
                      ...analysisPoint,
                      x: (analysisPoint.coordinates || [])[0],
                      y: (analysisPoint.coordinates || [])[1],
                      z: (analysisPoint.coordinates || [])[2],
                      isNew: false,
                  }));

        return {
            ...analysis,
            conditions: parsedConditions,
            points: parsedPoints,
            isNew: false,
        };
    });

    return studyAnalyses;
};

export const storeAnalysesToStudyAnalyses = (analyses?: IStoreAnalysis[]): AnalysisReturn[] => {
    // the backend API complains when we give an analysis ID that does not exist.
    // we therefore need to scrub the id from the analysis if it was newly created by us.
    // we also need to remove the readonly attributes and any attributes we added
    const updatedAnalyses = (analyses || []).map(
        ({ isNew, updated_at, created_at, user, conditions, ...args }) => {
            const scrubbedConditions: ConditionRequest[] = conditions.map(
                ({ isNew, updated_at, created_at, user, ...args }) => ({
                    ...args,
                    id: isNew ? undefined : args.id,
                })
            );
            return {
                ...args,
                conditions: scrubbedConditions,
                id: isNew ? undefined : args.id,
            };
        }
    );

    return updatedAnalyses;
};
