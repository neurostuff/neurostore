import { AxiosResponse } from 'axios';
import { IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import { setUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { AnalysisReturn, ImageReturn, StudyReturn } from 'neurostore-typescript-sdk';
import { arrayToMetadata, metadataToArray } from 'pages/StudyCBMA/components/EditStudyMetadata';
import {
    IStoreAnalysis,
    IStoreCondition,
    IStorePoint,
    IStoreStudy,
    PointWarnings,
    StudyDetails,
    getEmptyStudy,
    getPointWarnings,
    storeAnalysesToStudyAnalyses,
    studyAnalysesToStoreAnalyses,
} from './StudyStore.helpers';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API from 'api/api.config';
import { v4 as uuid } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type StudyStoreActions = {
    initStudyStore: (studyId?: string) => void;
    clearStudyStore: () => void;
    updateStudy: (fieldName: keyof StudyDetails, value: string | number) => void;
    updateStudyInDB: () => Promise<StudyReturn>;
    addOrUpdateStudyMetadataRow: (row: IMetadataRowModel) => void;
    deleteStudyMetadataRow: (key: string) => void;
    addOrUpdateAnalysis: (analysis: Partial<IStoreAnalysis>) => IStoreAnalysis;
    deleteAnalysis: (analysisId: string) => void;
    createCondition: (condition: IStoreCondition) => IStoreCondition;
    addOrUpdateConditionWeightPairForAnalysis: (analysisId: string, condition: IStoreCondition, weight: number) => void;
    deleteConditionFromAnalysis: (analysisId: string, conditionId: string) => void;
    /** Turns on Save and the leave warning. Does not write point rows. */
    markStudyEdited: () => void;
    /** Replaces one analysis's points. Does not mark the study edited. */
    replaceAnalysisPoints: (analysisId: string, points: IStorePoint[]) => void;
    /** Live warnings from the coordinates table, which holds unsaved rows. Pass undefined to remove them. */
    setAnalysisPointWarnings: (analysisId: string, pointWarnings?: PointWarnings) => void;
};

type StudyStoreMetadata = {
    studyIsEdited: boolean;
    getStudyIsLoading: boolean;
    updateStudyIsLoading: boolean;
    isError: boolean; // for http errors that occur
    validation: Record<string, PointWarnings>; // analysis id -> warnings
};

export const useStudyStore = create<
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
                    validation: {},
                },
                initStudyStore: async (studyId) => {
                    if (!studyId) return;
                    set((state) => ({
                        ...state,
                        storeMetadata: {
                            ...state.storeMetadata,
                            getStudyIsLoading: true,
                            updateStudyIsLoading: true,
                            validation: {},
                        },
                    }));
                    try {
                        const studyRes = await API.NeurostoreServices.StudiesService.studiesIdGet(studyId, true);
                        // const conditionsRes =
                        //     await API.NeurostoreServices.ConditionsService.conditionsGet();

                        set((state) => ({
                            ...state,
                            study: {
                                ...state.study,
                                ...studyRes.data,
                                analyses: studyAnalysesToStoreAnalyses(
                                    studyRes.data.analyses as AnalysisReturn[],
                                    true
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
                    set(() => ({
                        study: getEmptyStudy(),
                        storeMetadata: {
                            studyIsEdited: false,
                            getStudyIsLoading: false,
                            updateStudyIsLoading: false,
                            isError: false,
                            validation: {},
                        },
                        conditions: [],
                    }));
                },
                updateStudy: (fieldName, value) => {
                    setUnloadHandler('study');
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
                                analyses: studyAnalysesToStoreAnalyses(studyRes.data.analyses as StudyReturn[], true),
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
                        throw new Error('Could not update study in DB', { cause: e });
                    }
                },
                addOrUpdateStudyMetadataRow: (row) => {
                    setUnloadHandler('study');
                    set((state) => {
                        const metadataUpdate = [...state.study.metadata];
                        const foundRowIndex = metadataUpdate.findIndex((x) => x.metadataKey === row.metadataKey);
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
                    setUnloadHandler('study');
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
                    setUnloadHandler('study');
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
                            points: [
                                {
                                    cluster_size: undefined,
                                    id: uuid(),
                                    isNew: true,
                                    value: undefined,
                                    subpeak: undefined,
                                    x: undefined,
                                    y: undefined,
                                    z: undefined,
                                },
                            ],
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
                    setUnloadHandler('study');
                    set((state) => {
                        const updatedAnalyses = [...state.study.analyses.filter((x) => x.id !== analysisId)];

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
                        const foundAnalysisIndex = updatedAnalyses.findIndex((x) => x.id === analysisId);
                        if (foundAnalysisIndex < 0) return state;

                        const updatedWeights = [...(updatedAnalyses[foundAnalysisIndex].weights || [])];
                        const updatedConditions = [...updatedAnalyses[foundAnalysisIndex].conditions];
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
                                weights: [weight, ...(updatedAnalyses[foundAnalysisIndex].weights as number[])],
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
                        const foundAnalysisIndex = updatedAnalyses.findIndex((x) => x.id === analysisId);
                        if (foundAnalysisIndex < 0) return state;

                        const foundConditionIndex = updatedAnalyses[foundAnalysisIndex].conditions.findIndex(
                            (x) => x.id === conditionId
                        );
                        if (foundConditionIndex < 0) return state;
                        const updatedConditions = [...updatedAnalyses[foundAnalysisIndex].conditions];
                        const updatedWeights = [...(updatedAnalyses[foundAnalysisIndex].weights as number[])];
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
                markStudyEdited: () => {
                    setUnloadHandler('study');
                    set((state) => {
                        if (state.storeMetadata.studyIsEdited) return state;
                        return {
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                studyIsEdited: true,
                            },
                        };
                    });
                },
                replaceAnalysisPoints: (analysisId, points) => {
                    set((state) => {
                        const foundAnalysisIndex = state.study.analyses.findIndex(
                            (analysis) => analysis.id === analysisId
                        );
                        if (foundAnalysisIndex < 0) return state;

                        const updatedAnalyses = [...state.study.analyses];
                        updatedAnalyses[foundAnalysisIndex] = {
                            ...updatedAnalyses[foundAnalysisIndex],
                            points,
                        };

                        return {
                            ...state,
                            study: {
                                ...state.study,
                                analyses: updatedAnalyses,
                            },
                        };
                    });
                },
                setAnalysisPointWarnings: (analysisId, pointWarnings) => {
                    set((state) => {
                        const updatedValidation = { ...state.storeMetadata.validation };
                        if (pointWarnings) updatedValidation[analysisId] = pointWarnings;
                        else delete updatedValidation[analysisId];

                        return {
                            ...state,
                            storeMetadata: {
                                ...state.storeMetadata,
                                validation: updatedValidation,
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
export const useGetStudyIsLoading = () => useStudyStore((state) => state.storeMetadata.getStudyIsLoading);
export const useUpdateStudyIsLoading = () => useStudyStore((state) => state.storeMetadata.updateStudyIsLoading);
export const useStudyHasBeenEdited = () => useStudyStore((state) => state.storeMetadata.studyIsEdited);

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
export const useStudyAnalysisWarnings = (analysisId?: string) =>
    useStudyStore(
        useShallow((state) => {
            const foundAnalysis = analysisId ? state.study.analyses.find((x) => x.id === analysisId) : undefined;
            const name = foundAnalysis ? foundAnalysis.name : '';
            // the coordinates table holds unsaved rows, so its warnings win over the stored points.
            // state persisted before validation existed has no validation object
            const pointWarnings =
                (analysisId && state.storeMetadata.validation?.[analysisId]) ||
                getPointWarnings(foundAnalysis?.points || []);

            return {
                hasNoName: (name || '').length === 0,
                hasDuplicateName: state.study.analyses.some((x) => x.id !== analysisId && x.name === name),
                ...pointWarnings,
            };
        })
    );

// keep stable reference to empty array
const EMPTY_ANALYSIS_IMAGES: ImageReturn[] = [];
export const useStudyAnalysisImages = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return EMPTY_ANALYSIS_IMAGES;

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return EMPTY_ANALYSIS_IMAGES;
        const imgs = foundAnalysis.images;
        if (!imgs || !Array.isArray(imgs)) return EMPTY_ANALYSIS_IMAGES;
        return imgs as ImageReturn[];
    });

export const useNumStudyAnalyses = () => useStudyStore((state) => state.study.analyses.length);
export const useStudyAnalyses = () => useStudyStore((state) => state.study.analyses);
export const useStudyStoreIsError = () => useStudyStore((state) => state.storeMetadata.isError);
export const useStudyUser = () => useStudyStore((state) => state.study.user);
export const useStudyUsername = () => useStudyStore((state) => state.study.username);
export const useStudyLastUpdated = () =>
    useStudyStore((state) => (state.study.updated_at ? state.study.updated_at : state.study.created_at));
export const useStudyCreatedAt = () => useStudyStore((state) => state.study.created_at);

// study action hooks
export const useInitStudyStore = () => useStudyStore((state) => state.initStudyStore);
export const useClearStudyStore = () => useStudyStore((state) => state.clearStudyStore);
export const useUpdateStudyDetails = () => useStudyStore((state) => state.updateStudy);
export const useUpdateStudyInDB = () => useStudyStore((state) => state.updateStudyInDB);
export const useAddOrUpdateMetadata = () => useStudyStore((state) => state.addOrUpdateStudyMetadataRow);
export const useDeleteMetadataRow = () => useStudyStore((state) => state.deleteStudyMetadataRow);
export const useAddOrUpdateAnalysis = () => useStudyStore((state) => state.addOrUpdateAnalysis);
export const useCreateCondition = () => useStudyStore((state) => state.createCondition);
export const useAddOrUpdateConditionWeightPairForAnalysis = () =>
    useStudyStore((state) => state.addOrUpdateConditionWeightPairForAnalysis);
export const useDeleteConditionFromAnalysis = () => useStudyStore((state) => state.deleteConditionFromAnalysis);
export const useMarkStudyEdited = () => useStudyStore((state) => state.markStudyEdited);
export const useReplaceAnalysisPoints = () => useStudyStore((state) => state.replaceAnalysisPoints);
export const useSetAnalysisPointWarnings = () => useStudyStore((state) => state.setAnalysisPointWarnings);
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
