import { useEffect } from 'react';
import { persist } from 'zustand/middleware';
import { useParams } from 'react-router-dom';
import { create } from 'zustand';
import {
    IStoreAnalysis,
    IStoreCondition,
    IStorePoint,
    IStoreStudy,
    StudyDetails,
    storeAnalysesToStudyAnalyses,
    studyAnalysesToStoreAnalyses,
} from './StudyStore.helpers';
import { IMetadataRowModel } from 'components/EditMetadata';
import API from 'utils/api';
import {
    arrayToMetadata,
    metadataToArray,
} from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import { AnalysisReturn, StudyReturn } from 'neurostore-typescript-sdk';
import { v4 as uuid } from 'uuid';
import { setAnalysesInAnnotationAsIncluded } from 'components/ExtractionComponents/Ingestion/helpers/utils';

export type StudyStoreActions = {
    initStudyStore: (studyId?: string) => void;
    clearStudyStore: () => void;
    updateStudy: (fieldName: keyof StudyDetails, value: string | number) => void;
    updateStudyInDB: (annotationId: string | undefined) => Promise<void>;
    addOrUpdateStudyMetadataRow: (row: IMetadataRowModel) => void;
    deleteStudyMetadataRow: (key: string) => void;
    addOrUpdateAnalysis: (analysis: Partial<IStoreAnalysis>) => void;
    deleteAnalysis: (analysisId: string) => void;
    createCondition: (condition: IStoreCondition) => IStoreCondition;
    addOrUpdateConditionWeightPairForAnalysis: (
        analysisId: string,
        condition: IStoreCondition,
        weight: number
    ) => void;
    deleteConditionFromAnalysis: (analysisId: string, conditionId: string) => void;
    createAnalysisPoints: (analysisId: string, points: IStorePoint[], index: number) => void;
    deleteAnalysisPoints: (analysisId: string, pointIds: string[]) => void;
    updateAnalysisPoints: (analysisId: string, points: IStorePoint[]) => void;
    setIsValid: (isValid: boolean) => void;
};

type StudyStoreMetadata = {
    studyIsEdited: boolean;
    studyIsLoading: boolean;
    conditionsIsEdited: boolean;
    conditionsIsLoading: boolean;
    isError: boolean; // for http errors that occur
    isValid: boolean; // flag denoting if the form is valid
};

const useStudyStore = create<
    {
        study: IStoreStudy;
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
                conditions: [],
                storeMetadata: {
                    studyIsEdited: false,
                    studyIsLoading: false,
                    isError: false,
                    conditionsIsEdited: false,
                    conditionsIsLoading: false,
                    isValid: true,
                },
                initStudyStore: async (studyId) => {
                    if (!studyId) return;
                    set((state) => ({
                        ...state,
                        storeMetadata: {
                            ...state.storeMetadata,
                            studyIsLoading: true,
                        },
                    }));
                    try {
                        const studyRes = await API.NeurostoreServices.StudiesService.studiesIdGet(
                            studyId,
                            true
                        );
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
                            conditions: conditionsRes.data.results?.map((x) => ({
                                ...x,
                                isNew: false,
                            })),
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: false,
                                studyIsLoading: false,
                                conditionsIsLoading: false,
                                conditionsIsEdited: false,
                            },
                        }));
                    } catch (e) {
                        console.error(e);
                        set((state) => ({
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsLoading: false,
                                conditionsIsLoading: false,
                                isError: true,
                            },
                        }));
                    }
                },
                setIsValid: (isValid) => {
                    set((state) => ({
                        ...state,
                        storeMetadata: {
                            ...state.storeMetadata,
                            isValid: isValid,
                        },
                    }));
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
                        storeMetadata: {
                            studyIsEdited: false,
                            studyIsLoading: false,
                            conditionsIsEdited: false,
                            conditionsIsLoading: false,
                            isError: false,
                            isValid: true,
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
                updateStudyInDB: async (annotationId) => {
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

                        if (annotationId) {
                            await setAnalysesInAnnotationAsIncluded(annotationId);
                        }

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
                        console.error(e);
                        throw new Error('Could not update study in DB');
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
                        if (foundAnalysisIndex < 0) {
                            updatedAnalyses.unshift({
                                ...analysis,
                                isNew: true,
                                conditions: [],
                                weights: [],
                                points: [],
                                pointSpace: undefined,
                                pointStatistic: undefined,
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
                            },
                        };
                    });
                },
                deleteAnalysis: (analysisId) => {
                    set((state) => {
                        const updatedAnalyses = [
                            ...state.study.analyses.filter((x) => x.id !== analysisId),
                        ];

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
                createAnalysisPoints: (analysisId, points, index) => {
                    set((state) => {
                        const updatedAnalyses = [...state.study.analyses];
                        const foundAnalysisIndex = updatedAnalyses.findIndex(
                            (x) => x.id === analysisId
                        );
                        if (foundAnalysisIndex < 0) return state;
                        const updatedPoints = [...state.study.analyses[foundAnalysisIndex].points];

                        updatedPoints.splice(
                            index,
                            0,
                            ...points.map((x) => ({
                                x: undefined,
                                y: undefined,
                                z: undefined,
                                cluster_size: undefined,
                                subpeak: undefined,
                                ...x,
                                isNew: true,
                                id: uuid(), // temporary ID until one is assigned by neurostore
                            }))
                        );
                        updatedAnalyses[foundAnalysisIndex] = {
                            ...updatedAnalyses[foundAnalysisIndex],
                            points: updatedPoints,
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
                deleteAnalysisPoints: (analysisId, ids) => {
                    set((state) => {
                        const updatedAnalyses = [...state.study.analyses];
                        const foundAnalysisIndex = updatedAnalyses.findIndex(
                            (x) => x.id === analysisId
                        );
                        if (foundAnalysisIndex < 0) return state;
                        const updatedPoints = [
                            ...state.study.analyses[foundAnalysisIndex].points,
                        ].filter((point) => !ids.includes(point.id as string));

                        updatedAnalyses[foundAnalysisIndex] = {
                            ...updatedAnalyses[foundAnalysisIndex],
                            points: updatedPoints,
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
                updateAnalysisPoints: (analysisId, pointsToUpdate) => {
                    set((state) => {
                        const updatedAnalyses = [...state.study.analyses];
                        const foundAnalysisIndex = updatedAnalyses.findIndex(
                            (x) => x.id === analysisId
                        );
                        if (foundAnalysisIndex < 0) return state;

                        const updatedPoints = [...state.study.analyses[foundAnalysisIndex].points];
                        pointsToUpdate.forEach((pointToUpdate) => {
                            const pointToUpdateId = pointToUpdate.id as string;
                            const foundPointIndex = updatedPoints.findIndex(
                                (x) => x.id === pointToUpdateId
                            );
                            if (foundPointIndex < 0) return;
                            updatedPoints[foundPointIndex] = {
                                ...updatedPoints[foundPointIndex],
                                ...pointToUpdate,
                            };
                        });

                        updatedAnalyses[foundAnalysisIndex] = {
                            ...updatedAnalyses[foundAnalysisIndex],
                            points: updatedPoints,
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
export const useConditionsIsLoading = () =>
    useStudyStore((state) => state.storeMetadata.conditionsIsLoading);
export const useStudyHasBeenEdited = () =>
    useStudyStore((state) => state.storeMetadata.studyIsEdited);
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
        if (!foundAnalysis) return null;
        return foundAnalysis.points || null;
    });
export const useStudyAnalysisPointSpace = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return null;

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return null;
        return foundAnalysis.pointSpace;
    });
export const useStudyAnalysisPointStatistic = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return null;

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return null;
        return foundAnalysis.pointStatistic;
    });
export const useNumStudyAnalyses = () => useStudyStore((state) => state.study.analyses.length);
export const useStudyAnalyses = () => useStudyStore((state) => state.study.analyses);
export const useIsValid = () => useStudyStore((state) => state.storeMetadata.isValid);
export const useIsError = () => useStudyStore((state) => state.storeMetadata.isError);
export const useStudyUser = () => useStudyStore((state) => state.study.user);

// study action hooks
export const useInitStudyStore = () => useStudyStore((state) => state.initStudyStore);
export const useClearStudyStore = () => useStudyStore((state) => state.clearStudyStore);
export const useUpdateStudyDetails = () => useStudyStore((state) => state.updateStudy);
export const useUpdateStudyInDB = () => useStudyStore((state) => state.updateStudyInDB);
export const useAddOrUpdateMetadata = () =>
    useStudyStore((state) => state.addOrUpdateStudyMetadataRow);
export const useDeleteMetadataRow = () => useStudyStore((state) => state.deleteStudyMetadataRow);
export const useAddOrUpdateAnalysis = () => useStudyStore((state) => state.addOrUpdateAnalysis);
export const useCreateCondition = () => useStudyStore((state) => state.createCondition);
export const useAddOrUpdateConditionWeightPairForAnalysis = () =>
    useStudyStore((state) => state.addOrUpdateConditionWeightPairForAnalysis);
export const useDeleteConditionFromAnalysis = () =>
    useStudyStore((state) => state.deleteConditionFromAnalysis);
export const useUpdateAnalysisPoints = () => useStudyStore((state) => state.updateAnalysisPoints);
export const useCreateAnalysisPoints = () => useStudyStore((state) => state.createAnalysisPoints);
export const useDeleteAnalysisPoints = () => useStudyStore((state) => state.deleteAnalysisPoints);
export const useSetIsValid = () => useStudyStore((state) => state.setIsValid);
export const useDeleteAnalysis = () => useStudyStore((state) => state.deleteAnalysis);
export const useInitStudyStoreIfRequired = () => {
    const clearStudyStore = useClearStudyStore();
    const initStudyStore = useInitStudyStore();

    const { studyId } = useParams<{ projectId: string; studyId: string }>();
    const studyIdFromProject = useStudyId();

    useEffect(() => {
        if (studyId !== studyIdFromProject) {
            clearStudyStore();
            initStudyStore(studyId);
        }
    }, [clearStudyStore, initStudyStore, studyId, studyIdFromProject]);
};
