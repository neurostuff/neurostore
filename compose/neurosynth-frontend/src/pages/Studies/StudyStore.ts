import { AxiosResponse } from 'axios';
import { IMetadataRowModel } from 'components/EditMetadata';
import {
    arrayToMetadata,
    metadataToArray,
} from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import {
    AnalysisReturn,
    ConditionReturn,
    PointRequest,
    StudyReturn,
} from 'neurostore-typescript-sdk';
import API, { NeurostoreAnnotation } from 'utils/api';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    noteKeyArrToObj,
    noteKeyObjToArr,
    NoteKeyType,
    storeAnalysesToStudyAnalyses,
    studyAnalysesToStoreAnalyses,
} from './StudyStore.helpers';
import { v4 as uuid } from 'uuid';

export interface IStoreAnalysis extends Omit<AnalysisReturn, 'conditions'> {
    isNew: boolean;
    conditions: IStoreCondition[];
}

export interface IStoreCondition extends ConditionReturn {
    isNew: boolean;
}

interface StoreStudy extends Omit<StudyReturn, 'metadata' | 'analyses'> {
    metadata: IMetadataRowModel[];
    analyses: IStoreAnalysis[];
}

interface StoreAnnotation extends Omit<NeurostoreAnnotation, 'note_keys'> {
    note_keys: NoteKeyType[];
}

export type StudyDetails = Pick<
    StudyReturn,
    'name' | 'description' | 'publication' | 'authors' | 'doi' | 'pmid' | 'year'
>;

export type StudyStoreActions = {
    initStudyStore: (studyId?: string, annotationId?: string) => void;
    clearStudyStore: () => void;
    updateStudy: (fieldName: keyof StudyDetails, value: string | number) => void;
    updateStudyInDB: () => Promise<void>;
    updateAnnotationInDB: () => Promise<void>;
    addOrUpdateStudyMetadataRow: (row: IMetadataRowModel) => void;
    deleteStudyMetadataRow: (key: string) => void;
    addOrUpdateAnalysis: (analysis: Partial<IStoreAnalysis>) => void;
    createCondition: (condition: IStoreCondition) => IStoreCondition;
    addOrUpdateConditionWeightPairForAnalysis: (
        analysisId: string,
        condition: IStoreCondition,
        weight: number
    ) => void;
    deleteConditionFromAnalysis: (analysisId: string, conditionId: string) => void;
    updateAnalysisPoints: (analysisId: string, points: PointRequest[]) => void;
};

type StudyStoreMetadata = {
    studyIsEdited: boolean;
    studyIsLoading: boolean;
    annotationIsEdited: boolean;
    annotationIsLoading: boolean;
    conditionsIsEdited: boolean;
    conditionsIsLoading: boolean;
    isError: boolean;
};

const useStudyStore = create<
    {
        study: StoreStudy;
        annotation: StoreAnnotation;
        conditions: IStoreCondition[];
        storeMetadata: StudyStoreMetadata;
    } & StudyStoreActions
>()(
    persist(
        (set) => {
            return {
                study: {
                    id: undefined,
                    name: undefined,
                    description: undefined,
                    doi: undefined,
                    pmid: undefined,
                    authors: undefined,
                    year: undefined,
                    publication: undefined,
                    public: undefined,
                    metadata: [],
                    analyses: [],
                    studysets: [],
                    user: undefined,
                    source: undefined,
                    source_id: undefined,
                    source_updated_at: undefined,
                    created_at: undefined,
                    updated_at: undefined,
                },
                annotation: {
                    id: undefined,
                    name: undefined,
                    description: undefined,
                    created_at: undefined,
                    metadata: null,
                    note_keys: [],
                    notes: [],
                    source: undefined,
                    source_id: undefined,
                    source_updated_at: undefined,
                    studyset: undefined,
                    updated_at: undefined,
                    user: undefined,
                },
                conditions: [],
                storeMetadata: {
                    studyIsEdited: false,
                    annotationIsEdited: false,
                    studyIsLoading: false,
                    annotationIsLoading: false,
                    isError: false,
                    conditionsIsEdited: false,
                    conditionsIsLoading: false,
                },

                initStudyStore: async (studyId, annotationId) => {
                    if (!studyId || !annotationId) return;
                    set((state) => ({
                        ...state,
                        isLoading: true,
                    }));
                    try {
                        const studyRes = await API.NeurostoreServices.StudiesService.studiesIdGet(
                            studyId,
                            true
                        );
                        const annotationRes =
                            (await API.NeurostoreServices.AnnotationsService.annotationsIdGet(
                                annotationId
                            )) as AxiosResponse<NeurostoreAnnotation>;
                        const conditionsRes =
                            await API.NeurostoreServices.ConditionsService.conditionsGet();

                        set((state) => ({
                            ...state,
                            study: {
                                ...state.study,
                                ...studyRes.data,
                                analyses: studyAnalysesToStoreAnalyses(
                                    studyRes.data.analyses as AnalysisReturn[]
                                ),
                                metadata: metadataToArray(studyRes?.data?.metadata || {}),
                            },
                            annotation: {
                                ...state.annotation,
                                ...annotationRes.data,
                                note_keys: noteKeyObjToArr(annotationRes.data.note_keys),
                            },
                            conditions: conditionsRes.data.results?.map((x) => ({
                                ...x,
                                isNew: false,
                            })),
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: false,
                                annotationIsEdited: false,
                                studyIsLoading: false,
                            },
                        }));
                    } catch (e) {
                        set((state) => ({
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsLoading: false,
                                isError: true,
                            },
                        }));
                    }
                },
                clearStudyStore: () => {
                    set((state) => ({
                        study: {
                            id: undefined,
                            name: undefined,
                            description: undefined,
                            doi: undefined,
                            pmid: undefined,
                            authors: undefined,
                            year: undefined,
                            publication: undefined,
                            public: undefined,
                            storeMetadata: [],
                            analyses: [],
                            studysets: [],
                            user: undefined,
                            source: undefined,
                            source_id: undefined,
                            source_updated_at: undefined,
                            created_at: undefined,
                            updated_at: undefined,
                            metadata: [],
                        },
                        annotation: {
                            id: undefined,
                            name: undefined,
                            description: undefined,
                            created_at: undefined,
                            metadata: null,
                            note_keys: [],
                            notes: [],
                            source: undefined,
                            source_id: undefined,
                            source_updated_at: undefined,
                            studyset: undefined,
                            updated_at: undefined,
                            user: undefined,
                        },
                        storeMetadata: {
                            studyIsEdited: false,
                            annotationIsEdited: false,
                            studyIsLoading: false,
                            annotationIsLoading: false,
                            conditionsIsEdited: false,
                            conditionsIsLoading: false,
                            isError: false,
                        },
                        conditions: [],
                    }));
                },
                updateStudy: (fieldName, value) => {
                    set((state) => ({
                        ...state,
                        study: {
                            ...state.study,
                            [fieldName]: value,
                        },
                        storeMetadata: {
                            ...state.storeMetadata,
                            studyIsEdited: true,
                        },
                    }));
                },
                updateStudyInDB: async () => {
                    try {
                        const state = useStudyStore.getState();
                        if (!state.study.id) throw new Error('no study id');
                        set((state) => ({
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsLoading: true,
                            },
                        }));

                        await API.NeurostoreServices.StudiesService.studiesIdPut(state.study.id, {
                            name: state.study.name,
                            description: state.study.description,
                            doi: state.study.doi,
                            pmid: state.study.pmid,
                            authors: state.study.authors,
                            year: state.study.year,
                            publication: state.study.publication,
                            metadata: arrayToMetadata(state.study.metadata),
                            analyses: storeAnalysesToStudyAnalyses(state.study.analyses),
                        });

                        // we want to reset the store with our new data because if we created any new
                        // analyses, they will now have their own IDs assigned to them by neurostore
                        const studyRes = await API.NeurostoreServices.StudiesService.studiesIdGet(
                            state.study.id,
                            true
                        );

                        set((state) => ({
                            ...state,
                            study: {
                                ...studyRes.data,
                                analyses: studyAnalysesToStoreAnalyses(
                                    studyRes.data.analyses as StudyReturn[]
                                ),
                                metadata: metadataToArray(studyRes?.data?.metadata || {}),
                            },
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: false,
                                studyIsLoading: false,
                            },
                        }));
                    } catch (e) {
                        set((state) => ({
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsLoading: false,
                                isError: true,
                            },
                        }));
                        throw new Error('error updating study');
                    }
                },
                updateAnnotationInDB: async () => {
                    try {
                        const state = useStudyStore.getState();
                        if (!state.annotation.id) throw new Error('no annotation id');
                        set((state) => ({
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                annotationIsLoading: true,
                            },
                        }));
                        await API.NeurostoreServices.AnnotationsService.annotationsIdPut(
                            state.annotation.id,
                            {
                                name: state.study.name,
                                description: state.study.description,
                                note_keys: noteKeyArrToObj(state.annotation.note_keys),
                                // we update the notes property via the analyses in the study object, not here
                            }
                        );
                        set((state) => ({
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                annotationIsEdited: false,
                                annotationIsLoading: false,
                            },
                        }));
                    } catch (e) {
                        set((state) => ({
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                annotationIsLoading: false,
                                isError: true,
                            },
                        }));
                        throw new Error('error updating study');
                    }
                },
                addOrUpdateStudyMetadataRow: (row) => {
                    set((state) => {
                        const metadataUpdate = [...state.study.metadata];
                        const foundRowIndex = metadataUpdate.findIndex(
                            (x) => x.metadataKey === row.metadataKey
                        );
                        if (foundRowIndex < 0) {
                            metadataUpdate.unshift({
                                ...row,
                            });
                        } else {
                            metadataUpdate[foundRowIndex] = {
                                ...metadataUpdate[foundRowIndex],
                                ...row,
                            };
                        }

                        return {
                            ...state,
                            study: {
                                ...state.study,
                                metadata: metadataUpdate,
                            },
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: true,
                            },
                        };
                    });
                },
                deleteStudyMetadataRow: (id) => {
                    set((state) => {
                        const metadataUpdate = [...state.study.metadata];
                        const foundRowIndex = metadataUpdate.findIndex((x) => x.metadataKey === id);
                        if (foundRowIndex < 0) return state;

                        metadataUpdate.splice(foundRowIndex, 1);

                        return {
                            ...state,
                            study: {
                                ...state.study,
                                metadata: metadataUpdate,
                            },
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: true,
                            },
                        };
                    });
                },
                addOrUpdateAnalysis: (analysis) => {
                    set((state) => {
                        const updatedAnalyses = [...state.study.analyses];
                        const foundAnalysisIndex = updatedAnalyses.findIndex(
                            (x) => (x.id || null) === (analysis.id || undefined)
                        );
                        let annotationIsEdited = false;
                        if (foundAnalysisIndex < 0) {
                            updatedAnalyses.unshift({
                                ...analysis,
                                isNew: true,
                                conditions: [],
                                weights: [],
                                id: uuid(), // this is a temporary ID until one is assigned via neurostore
                            });
                        } else {
                            updatedAnalyses[foundAnalysisIndex] = {
                                ...updatedAnalyses[foundAnalysisIndex],
                                ...analysis,
                            };
                        }

                        return {
                            ...state,
                            study: {
                                ...state.study,
                                analyses: updatedAnalyses,
                            },
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: true,
                                annotationIsEdited: annotationIsEdited,
                            },
                        };
                    });
                },
                createCondition: (condition) => {
                    const newCondition = {
                        ...condition,
                        id: uuid(),
                        isNew: true,
                    };

                    set((state) => ({
                        ...state,
                        conditions: [newCondition, ...state.conditions],
                        storeMetadata: {
                            ...state.storeMetadata,
                            studyIsEdited: true,
                        },
                    }));
                    return newCondition;
                },
                addOrUpdateConditionWeightPairForAnalysis: (analysisId, condition, weight) => {
                    set((state) => {
                        const updatedAnalyses = [...state.study.analyses];
                        const foundAnalysisIndex = updatedAnalyses.findIndex(
                            (x) => x.id === analysisId
                        );
                        if (foundAnalysisIndex < 0) return state;

                        const updatedWeights = [
                            ...(updatedAnalyses[foundAnalysisIndex].weights || []),
                        ];
                        const updatedConditions = [
                            ...updatedAnalyses[foundAnalysisIndex].conditions,
                        ];
                        const foundConditionIndex = updatedConditions.findIndex(
                            (x) => (x.id || null) === (condition.id || undefined)
                        );
                        if (foundConditionIndex < 0) {
                            updatedAnalyses[foundAnalysisIndex] = {
                                ...updatedAnalyses[foundAnalysisIndex],
                                conditions: [
                                    {
                                        ...condition,
                                    },
                                    ...updatedAnalyses[foundAnalysisIndex].conditions,
                                ],
                                weights: [
                                    weight,
                                    ...(updatedAnalyses[foundAnalysisIndex].weights as number[]),
                                ],
                            };
                        } else {
                            updatedConditions[foundConditionIndex] = {
                                ...updatedConditions[foundConditionIndex],
                                ...condition,
                            };
                            updatedWeights[foundConditionIndex] = weight;

                            updatedAnalyses[foundAnalysisIndex] = {
                                ...updatedAnalyses[foundAnalysisIndex],
                                conditions: updatedConditions,
                                weights: updatedWeights,
                            };
                        }

                        return {
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: true,
                            },
                            study: {
                                ...state.study,
                                analyses: updatedAnalyses,
                            },
                        };
                    });
                },
                deleteConditionFromAnalysis: (analysisId, conditionId) => {
                    set((state) => {
                        const updatedAnalyses = [...state.study.analyses];
                        const foundAnalysisIndex = updatedAnalyses.findIndex(
                            (x) => x.id === analysisId
                        );
                        if (foundAnalysisIndex < 0) return state;

                        const foundConditionIndex = updatedAnalyses[
                            foundAnalysisIndex
                        ].conditions.findIndex((x) => x.id === conditionId);
                        if (foundConditionIndex < 0) return state;
                        const updatedConditions = [
                            ...updatedAnalyses[foundAnalysisIndex].conditions,
                        ];
                        const updatedWeights = [
                            ...(updatedAnalyses[foundAnalysisIndex].weights as number[]),
                        ];
                        updatedConditions.splice(foundConditionIndex, 1);
                        updatedWeights.splice(foundConditionIndex, 1);

                        updatedAnalyses[foundAnalysisIndex] = {
                            ...updatedAnalyses[foundAnalysisIndex],
                            conditions: updatedConditions,
                            weights: updatedWeights,
                        };

                        return {
                            ...state,
                            study: {
                                ...state.study,
                                analyses: updatedAnalyses,
                            },
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: true,
                            },
                        };
                    });
                },
                updateAnalysisPoints: (analysisId, points) => {
                    set((state) => {
                        const updatedAnalyses = [...state.study.analyses];
                        const foundAnalysisIndex = updatedAnalyses.findIndex(
                            (x) => x.id === analysisId
                        );
                        if (foundAnalysisIndex < 0) return state;
                        updatedAnalyses[foundAnalysisIndex] = {
                            ...updatedAnalyses[foundAnalysisIndex],
                            points: [...points],
                        };
                        return {
                            ...state,
                            study: {
                                ...state.study,
                                analyses: updatedAnalyses,
                            },
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: true,
                            },
                        };
                    });
                },
            };
        },
        {
            name: 'neurosynth-study',
        }
    )
);

// study retrieval hooks
export const useStudyId = () => useStudyStore((state) => state.study.id);
export const useStudyIsLoading = () => useStudyStore((state) => state.storeMetadata.studyIsLoading);
export const useAnnotationIsLoading = () =>
    useStudyStore((state) => state.storeMetadata.annotationIsLoading);
export const useConditionsIsLoading = () =>
    useStudyStore((state) => state.storeMetadata.conditionsIsLoading);
export const useStudyHasBeenEdited = () =>
    useStudyStore((state) => state.storeMetadata.studyIsEdited);
export const useAnnotationHasBeenEdited = () =>
    useStudyStore((state) => state.storeMetadata.annotationIsEdited);
export const useConditionsIsEdited = () =>
    useStudyStore((state) => state.storeMetadata.conditionsIsEdited);

export const useStudyName = () => useStudyStore((state) => state.study.name);
export const useStudyDescription = () => useStudyStore((state) => state.study.description);
export const useStudyAuthors = () => useStudyStore((state) => state.study.authors);
export const useStudyPMID = () => useStudyStore((state) => state.study.pmid);
export const useStudyDOI = () => useStudyStore((state) => state.study.doi);
export const useStudyPublication = () => useStudyStore((state) => state.study.publication);
export const useStudyYear = () => useStudyStore((state) => state.study.year);

export const useStudyMetadata = () => useStudyStore((state) => state.study.metadata);
export const useAnnotation = () => useStudyStore((state) => state.annotation);
export const useConditions = () => useStudyStore((state) => state.conditions);

export const useStudyAnalysis = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return undefined;

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return undefined;
        return foundAnalysis;
    });
export const useStudyAnalysisName = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return '';

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return '';
        return foundAnalysis.name;
    });
export const useStudyAnalysisDescription = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return '';

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return '';
        return foundAnalysis.description;
    });
export const useStudyAnalysisConditions = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return [];

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return [];
        return foundAnalysis.conditions;
    });
export const useStudyAnalysisWeights = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return [];

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return [];
        return foundAnalysis.weights;
    });
export const useStudyAnalysisPoints = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return [];

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return [];
        return foundAnalysis.points || [];
    });
export const useNumStudyAnalyses = () => useStudyStore((state) => state.study.analyses.length);
export const useStudyAnalyses = () => useStudyStore((state) => state.study.analyses);

// study action hooks
export const useInitStudyStore = () => useStudyStore((state) => state.initStudyStore);
export const useClearStudyStore = () => useStudyStore((state) => state.clearStudyStore);
export const useUpdateStudyDetails = () => useStudyStore((state) => state.updateStudy);
export const useUpdateStudyInDB = () => useStudyStore((state) => state.updateStudyInDB);
export const useAddOrUpdateMetadata = () =>
    useStudyStore((state) => state.addOrUpdateStudyMetadataRow);
export const useDeleteMetadataRow = () => useStudyStore((state) => state.deleteStudyMetadataRow);
export const useAddOrUpdateAnalysis = () => useStudyStore((state) => state.addOrUpdateAnalysis);
export const useUpdateAnnotationInDB = () => useStudyStore((state) => state.updateAnnotationInDB);
export const useCreateCondition = () => useStudyStore((state) => state.createCondition);
export const useAddOrUpdateConditionWeightPairForAnalysis = () =>
    useStudyStore((state) => state.addOrUpdateConditionWeightPairForAnalysis);
export const useDeleteConditionFromAnalysis = () =>
    useStudyStore((state) => state.deleteConditionFromAnalysis);
export const useUpdateAnalysisPoints = () => useStudyStore((state) => state.updateAnalysisPoints);
