import { AxiosResponse } from 'axios';
import { IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import { arrayToMetadata, metadataToArray } from 'pages/Study/components/EditStudyMetadata';
import { AnalysisReturn, StudyReturn } from 'neurostore-typescript-sdk';
import { setAnalysesInAnnotationAsIncluded } from 'helpers/Annotation.helpers';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from 'utils/api';
import { v4 as uuid } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    IStoreAnalysis,
    IStoreCondition,
    IStorePoint,
    IStoreStudy,
    StudyDetails,
    getEmptyStudy,
    storeAnalysesToStudyAnalyses,
    studyAnalysesToStoreAnalyses,
} from 'pages/Study/store/StudyStore.helpers';

export type StudyStoreActions = {
    initStudyStore: (studyId?: string) => void;
    clearStudyStore: () => void;
    updateStudy: (fieldName: keyof StudyDetails, value: string | number) => void;
    updateStudyInDB: (annotationId: string | undefined) => Promise<StudyReturn>;
    addOrUpdateStudyMetadataRow: (row: IMetadataRowModel) => void;
    deleteStudyMetadataRow: (key: string) => void;
    addOrUpdateAnalysis: (analysis: Partial<IStoreAnalysis>) => IStoreAnalysis;
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
};

type StudyStoreMetadata = {
    studyIsEdited: boolean;
    getStudyIsLoading: boolean;
    updateStudyIsLoading: boolean;
    isError: boolean; // for http errors that occur
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
                study: getEmptyStudy(),
                conditions: [],
                storeMetadata: {
                    studyIsEdited: false,
                    getStudyIsLoading: false,
                    updateStudyIsLoading: false,
                    isError: false,
                },
                initStudyStore: async (studyId) => {
                    if (!studyId) return;
                    set((state) => ({
                        ...state,
                        storeMetadata: {
                            ...state.storeMetadata,
                            getStudyIsLoading: true,
                            updateStudyIsLoading: true,
                        },
                    }));
                    try {
                        const studyRes = await API.NeurostoreServices.StudiesService.studiesIdGet(
                            studyId,
                            true
                        );
                        // const conditionsRes =
                        //     await API.NeurostoreServices.ConditionsService.conditionsGet();

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
                            // conditions: conditionsRes.data.results?.map((x) => ({
                            //     ...x,
                            //     isNew: false,
                            // })),
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: false,
                                getStudyIsLoading: false,
                                updateStudyIsLoading: false,
                            },
                        }));
                    } catch (e) {
                        console.error(e);
                        set((state) => ({
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                getStudyIsLoading: false,
                                updateStudyIsLoading: false,
                                isError: true,
                            },
                        }));
                    }
                },
                clearStudyStore: () => {
                    set((state) => ({
                        study: getEmptyStudy(),
                        storeMetadata: {
                            studyIsEdited: false,
                            getStudyIsLoading: false,
                            updateStudyIsLoading: false,
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
                updateStudyInDB: async (annotationId) => {
                    try {
                        const state = useStudyStore.getState();
                        if (!state.study.id) throw new Error('no study id');
                        set((state) => ({
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                updateStudyIsLoading: true,
                            },
                        }));

                        await API.NeurostoreServices.StudiesService.studiesIdPut(state.study.id, {
                            name: state.study.name,
                            description: state.study.description,
                            doi: state.study.doi ? state.study.doi : undefined,
                            pmid: state.study.pmid ? state.study.pmid : undefined,
                            pmcid: state.study.pmcid ? state.study.pmcid : undefined,
                            authors: state.study.authors,
                            year: state.study.year,
                            publication: state.study.publication,
                            metadata: arrayToMetadata(state.study.metadata),
                            analyses: storeAnalysesToStudyAnalyses(state.study.analyses),
                        });

                        const newAnalysesWereCreated = state.study.analyses.some(
                            (analysis) => analysis.isNew
                        );
                        if (newAnalysesWereCreated && annotationId) {
                            // new analyses created are not included by default and need to be manually set
                            await setAnalysesInAnnotationAsIncluded(annotationId);
                        }

                        // we want to reset the store with our new data because if we created any new
                        // analyses, they will now have their own IDs assigned to them by neurostore.
                        // we cannot use the object returned by studiesIdPut as it is not nested.
                        // TODO: change return value of studiesIdPut to nested
                        const studyRes = (await API.NeurostoreServices.StudiesService.studiesIdGet(
                            state.study.id,
                            true
                        )) as AxiosResponse<StudyReturn>;

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
                                updateStudyIsLoading: false,
                            },
                        }));
                        return studyRes.data;
                    } catch (e) {
                        set((state) => ({
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                updateStudyIsLoading: false,
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
                    let createdOrUpdatedAnalysis: IStoreAnalysis;

                    // we do this outside the set func here so that we can return the updated or created analysis
                    const state = useStudyStore.getState();
                    const updatedAnalyses = [...state.study.analyses];
                    const foundAnalysisIndex = updatedAnalyses.findIndex(
                        (x) => (x.id || null) === (analysis.id || undefined)
                    );
                    if (foundAnalysisIndex < 0) {
                        const createdAnalysis: IStoreAnalysis = {
                            ...analysis,
                            isNew: true,
                            conditions: [],
                            weights: [],
                            points: [],
                            pointSpace: undefined,
                            pointStatistic: undefined,
                            id: uuid(), // this is a temporary ID until one is assigned via neurostore
                        };
                        createdOrUpdatedAnalysis = createdAnalysis;
                        updatedAnalyses.push(createdAnalysis);
                    } else {
                        const editedAnalysis: IStoreAnalysis = {
                            ...updatedAnalyses[foundAnalysisIndex],
                            ...analysis,
                        };
                        createdOrUpdatedAnalysis = editedAnalysis;
                        updatedAnalyses[foundAnalysisIndex] = editedAnalysis;
                    }

                    set((state) => {
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
                    return createdOrUpdatedAnalysis;
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
export const useStudy = () => useStudyStore((state) => state.study);
export const useStudyId = () => useStudyStore((state) => state.study.id);
export const useGetStudyIsLoading = () =>
    useStudyStore((state) => state.storeMetadata.getStudyIsLoading);
export const useUpdateStudyIsLoading = () =>
    useStudyStore((state) => state.storeMetadata.updateStudyIsLoading);
export const useStudyHasBeenEdited = () =>
    useStudyStore((state) => state.storeMetadata.studyIsEdited);

export const useStudyBaseStudyId = () => useStudyStore((state) => state.study.base_study);
export const useStudyName = () => useStudyStore((state) => state.study.name);
export const useStudyDescription = () => useStudyStore((state) => state.study.description);
export const useStudyAuthors = () => useStudyStore((state) => state.study.authors);
export const useStudyPMID = () => useStudyStore((state) => state.study.pmid);
export const useStudyPMCID = () => useStudyStore((state) => state.study.pmcid);
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
export const useDebouncedStudyAnalyses = () => {
    const [debouncedAnalyses, setDebouncedAnalyses] = useState(
        useStudyStore.getState().study.analyses
    );
    useEffect(() => {
        let debounce: NodeJS.Timeout;
        const unsub = useStudyStore.subscribe((state) => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => {
                setDebouncedAnalyses(state.study.analyses);
            }, 400);
        });

        return () => {
            unsub();
            clearTimeout(debounce);
        };
    }, []);
    return debouncedAnalyses;
};

export const useStudyStoreIsError = () => useStudyStore((state) => state.storeMetadata.isError);
export const useStudyUser = () => useStudyStore((state) => state.study.user);
export const useStudyUsername = () => useStudyStore((state) => state.study.username);
export const useStudyLastUpdated = () =>
    useStudyStore((state) =>
        state.study.updated_at ? state.study.updated_at : state.study.created_at
    );

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
