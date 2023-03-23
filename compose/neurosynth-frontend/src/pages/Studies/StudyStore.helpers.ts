import { EPropertyType } from 'components/EditMetadata';
import { AnalysisReturn, ConditionRequest, ConditionReturn } from 'neurostore-typescript-sdk';
import { IStoreAnalysis, IStoreCondition } from './StudyStore';
export interface NoteKeyType {
    key: string;
    type: EPropertyType;
}

export const noteKeyObjToArr = (noteKeys?: object | null): NoteKeyType[] => {
    if (!noteKeys) return [];
    const noteKeyTypes = noteKeys as { [key: string]: EPropertyType };
    const arr = Object.entries(noteKeyTypes).map(([key, type]) => ({
        key,
        type,
    }));
    return arr;
};

export const noteKeyArrToObj = (noteKeyArr: NoteKeyType[]): { [key: string]: EPropertyType } => {
    const noteKeyObj: { [key: string]: EPropertyType } = noteKeyArr.reduce((acc, curr) => {
        acc[curr.key] = curr.type;
        return acc;
    }, {} as { [key: string]: EPropertyType });

    return noteKeyObj;
};

export const studyAnalysesToStoreAnalyses = (analyses?: AnalysisReturn[]): IStoreAnalysis[] => {
    const studyAnalyses: IStoreAnalysis[] = (analyses || []).map((analysis) => {
        const parsedConditions: IStoreCondition[] = (
            (analysis.conditions || []) as ConditionReturn[]
        ).map((condition) => ({
            ...condition,
            isNew: false,
        }));

        return {
            ...analysis,
            conditions: parsedConditions,
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
