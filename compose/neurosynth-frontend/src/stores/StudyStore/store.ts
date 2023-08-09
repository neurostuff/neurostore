import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TStudyStore } from 'stores/StudyStore/models';
import { storeAnalysesToStudyAnalyses, studyAnalysesToStoreAnalyses } from './utils';
import {
    metadataToArray,
    arrayToMetadata,
} from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import { setAnalysesInAnnotationAsIncluded } from 'components/ExtractionComponents/Ingestion/helpers/utils';
import { AnalysisReturn, StudyReturn } from 'neurostore-typescript-sdk';
import API from 'utils/api';
import { v4 as uuidv4 } from 'uuid';

const useStudyStore = create<TStudyStore>()(
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
                                id: uuidv4(), // this is a temporary ID until one is assigned via neurostore
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
                        id: uuidv4(),
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
                                id: uuidv4(), // temporary ID until one is assigned by neurostore
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

export default useStudyStore;
