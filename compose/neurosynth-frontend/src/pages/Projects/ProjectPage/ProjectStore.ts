import { DropResult, ResponderProvided } from '@hello-pangea/dnd';
import { AxiosResponse } from 'axios';
import { EPropertyType } from 'components/EditMetadata';
import {
    IExtractionMetadata,
    INeurosynthProject,
    INeurosynthProjectReturn,
    IPRISMAConfig,
    ISource,
    ITag,
} from 'hooks/requests/useGetProjects';
import API from 'utils/api';
import { create, StateCreator, StoreMutatorIdentifier } from 'zustand';
import {
    addNewStubsHelper,
    handleDragEndHelper,
    initCurationHelper,
    updateStubFieldHelper,
    promoteStubHelper,
    addTagToStubHelper,
    createNewExclusionHelper,
    removeTagFromStubHelper,
    setExclusionForStubHelper,
} from './ProjectStore.helpers';
import { persist } from 'zustand/middleware';
import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';

type ProjectStoreActions = {
    updateProjectName: (name: string) => void;
    updateProjectDescription: (description: string) => void;
    initStore: (projectId: string | undefined) => void;
    initCuration: (cols: string[], isPrisma: boolean) => void;
    handleDrag: (result: DropResult, provided: ResponderProvided) => void;
    createNewExclusion: (
        newExclusion: ITag,
        arg: keyof Omit<IPRISMAConfig, 'isPrisma'> | undefined
    ) => void;
    createNewInfoTag: (newTag: ITag) => void;
    createNewIdentificationSource: (newSource: ISource) => void;
    addNewStubs: (stubs: ICurationStubStudy[]) => void;
    updateCurationColumns: (columns: ICurationColumn[]) => void;
    clearProvenance: () => void;
    updateStubField: (
        columnIndex: number,
        stubId: string,
        field: keyof ICurationStubStudy,
        updatedValue: string | number | ISource
    ) => void;
    addTagToStub: (columnIndex: number, stubId: string, newTag: ITag) => void;
    removeTagFromStub: (columnIndex: number, stubId: string, tagId: string) => void;
    setExclusionForStub: (columnIndex: number, stubId: string, exclusion: ITag | null) => void;
    promoteStub: (columnIndex: number, stubId: string) => void;
    updateExtractionMetadata: (metadata: IExtractionMetadata) => void;
};

type APIDebouncedUpdater = <
    T extends unknown,
    Mps extends [StoreMutatorIdentifier, unknown][] = [],
    Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
    f: StateCreator<T, Mps, Mcs>,
    name?: string
) => StateCreator<T, Mps, Mcs>;

type APIDebouncedUpdaterImpl = <T extends unknown>(
    f: StateCreator<T, [], []>,
    name?: string
) => StateCreator<T, [], []>;

const apiDebouncedUpdaterImpl: APIDebouncedUpdaterImpl = (f, name) => (set, get, store) => {
    let timeout: number | NodeJS.Timeout | undefined = undefined;

    const debouncedAPIUpdaterSet: typeof set = (...a) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            const storeData = get() as unknown as INeurosynthProjectReturn & ProjectStoreActions;
            const update: INeurosynthProject = {
                name: storeData.name,
                description: storeData.description,
                provenance: {
                    ...storeData.provenance,
                },
            };
            console.log('update: ', update);
            localStorage.setItem(`updateCurationIsLoading`, 'true');
            window.dispatchEvent(new Event('storage'));
            API.NeurosynthServices.ProjectsService.projectsIdPut(
                storeData.id || '',
                update
            ).finally(() => {
                localStorage.setItem(`updateCurationIsLoading`, 'false');
                window.dispatchEvent(new Event('storage'));
            });
        }, 4000);

        set(...a);
    };
    // replace all state updater functions with our custom implementation
    store.setState = debouncedAPIUpdaterSet;
    return f(debouncedAPIUpdaterSet, get, store);
};

export const apiDebouncedUpdaterImplMiddleware =
    apiDebouncedUpdaterImpl as unknown as APIDebouncedUpdater;

const useProjectStore = create<INeurosynthProjectReturn & ProjectStoreActions>()(
    apiDebouncedUpdaterImplMiddleware(
        persist(
            (set) => {
                return {
                    // project
                    name: '',
                    id: undefined,
                    meta_analyses: [],
                    description: '',
                    provenance: {
                        curationMetadata: {
                            columns: [],
                            prismaConfig: {
                                isPrisma: false,
                                identification: {
                                    exclusionTags: [],
                                },
                                screening: {
                                    exclusionTags: [],
                                },
                                eligibility: {
                                    exclusionTags: [],
                                },
                            },
                            infoTags: [],
                            exclusionTags: [],
                            identificationSources: [],
                        },
                        extractionMetadata: {
                            studysetId: undefined,
                            annotationId: undefined,
                            studyStatusList: [],
                        },
                        filtrationMetadata: {
                            filter: {
                                filtrationKey: undefined,
                                type: EPropertyType.NONE,
                            },
                        },
                        algorithmMetadata: {
                            specificationId: undefined,
                        },
                    },

                    // just for testing purposes
                    clearProvenance: async () => {
                        const emptyProvenance = {
                            curationMetadata: {
                                columns: [],
                                prismaConfig: {
                                    isPrisma: false,
                                    identification: {
                                        exclusionTags: [],
                                    },
                                    screening: {
                                        exclusionTags: [],
                                    },
                                    eligibility: {
                                        exclusionTags: [],
                                    },
                                },
                                infoTags: [],
                                exclusionTags: [],
                                identificationSources: [],
                            },
                            extractionMetadata: {
                                studysetId: undefined,
                                annotationId: undefined,
                                studyStatusList: [],
                            },
                            filtrationMetadata: {
                                filter: {
                                    filtrationKey: undefined,
                                    type: EPropertyType.NONE,
                                },
                            },
                            algorithmMetadata: {
                                specificationId: undefined,
                            },
                        };
                        const id = useProjectStore.getState().id;

                        await API.NeurosynthServices.ProjectsService.projectsIdPut(id || '', {
                            provenance: emptyProvenance,
                        });
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...emptyProvenance,
                            },
                        }));
                    },
                    initStore: async (projectId: string | undefined) => {
                        if (!projectId) return;

                        const currId = useProjectStore.getState().id;
                        if (currId !== projectId) {
                            const res = (await API.NeurosynthServices.ProjectsService.projectsIdGet(
                                projectId
                            )) as AxiosResponse<INeurosynthProjectReturn>;
                            set((state) => ({
                                ...state,
                                ...res.data,
                            }));
                        }
                    },
                    initCuration: (cols: string[], isPrisma: boolean) => {
                        set((state) => {
                            const update = {
                                ...state,
                                provenance: {
                                    ...state.provenance,
                                    curationMetadata: {
                                        ...state.provenance.curationMetadata,
                                        ...initCurationHelper(cols, isPrisma),
                                    },
                                },
                            };
                            return update;
                        });
                    },
                    updateProjectName: (name: string) => {
                        set((state) => ({
                            ...state,
                            name: name,
                        }));
                    },
                    updateProjectDescription: (description: string) => {
                        set((state) => ({
                            ...state,
                            description: description,
                        }));
                    },
                    handleDrag: (result, provided) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...state.provenance.curationMetadata,
                                    columns: handleDragEndHelper(
                                        state.provenance.curationMetadata.columns,
                                        result,
                                        provided
                                    ),
                                },
                            },
                        }));
                    },
                    createNewExclusion: (newExclusion, phase) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...createNewExclusionHelper(
                                        state.provenance.curationMetadata,
                                        newExclusion,
                                        phase
                                    ),
                                },
                            },
                        }));
                    },
                    createNewInfoTag: (newTag: ITag) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...state.provenance.curationMetadata,
                                    infoTags: [
                                        ...state.provenance.curationMetadata.infoTags,
                                        { ...newTag },
                                    ],
                                },
                            },
                        }));
                    },
                    addTagToStub: (columnIndex, stubId, newTag) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...state.provenance.curationMetadata,
                                    columns: addTagToStubHelper(
                                        state.provenance.curationMetadata.columns,
                                        columnIndex,
                                        stubId,
                                        newTag
                                    ),
                                },
                            },
                        }));
                    },
                    createNewIdentificationSource: (newSource: ISource) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...state.provenance.curationMetadata,
                                    identificationSources: [
                                        ...state.provenance.curationMetadata.identificationSources,
                                        { ...newSource },
                                    ],
                                },
                            },
                        }));
                    },
                    addNewStubs: (stubs) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...state.provenance.curationMetadata,
                                    columns: addNewStubsHelper(
                                        state.provenance.curationMetadata.columns,
                                        stubs
                                    ),
                                },
                            },
                        }));
                    },
                    updateCurationColumns(columns) {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...state.provenance.curationMetadata,
                                    columns: columns,
                                },
                            },
                        }));
                    },
                    updateStubField: (columnIndex, stubId, field, value) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...state.provenance.curationMetadata,
                                    columns: updateStubFieldHelper(
                                        state.provenance.curationMetadata.columns,
                                        columnIndex,
                                        stubId,
                                        field,
                                        value
                                    ),
                                },
                            },
                        }));
                    },
                    removeTagFromStub: (columnIndex, stubId, tagId) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...state.provenance.curationMetadata,
                                    columns: removeTagFromStubHelper(
                                        state.provenance.curationMetadata.columns,
                                        columnIndex,
                                        stubId,
                                        tagId
                                    ),
                                },
                            },
                        }));
                    },
                    setExclusionForStub: (columnIndex, stubId, exclusion) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...state.provenance.curationMetadata,
                                    columns: setExclusionForStubHelper(
                                        state.provenance.curationMetadata.columns,
                                        columnIndex,
                                        stubId,
                                        exclusion
                                    ),
                                },
                            },
                        }));
                    },
                    promoteStub: (columnIndex, stubId) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                curationMetadata: {
                                    ...state.provenance.curationMetadata,
                                    columns: promoteStubHelper(
                                        state.provenance.curationMetadata.columns,
                                        columnIndex,
                                        stubId
                                    ),
                                },
                            },
                        }));
                    },
                    updateExtractionMetadata: (metadata) => {
                        set((state) => ({
                            ...state,
                            provenance: {
                                ...state.provenance,
                                extractionMetadata: {
                                    ...state.provenance.extractionMetadata,
                                    ...metadata,
                                },
                            },
                        }));
                    },
                };
            },
            {
                name: 'neurosynth-project',
            }
        ),
        'neurosynth-store'
    )
);

// higher level project retrieval hooks
export const useProjectName = () => useProjectStore((state) => state.name);
export const useProjectDescription = () => useProjectStore((state) => state.description);
export const useProjectProvenance = () => useProjectStore((state) => state.provenance);

// curation retrieval hooks
export const useProjectCurationColumns = () =>
    useProjectStore((state) => state.provenance.curationMetadata.columns);
export const useProjectCurationIsLastColumn = (columnIndex: number) =>
    useProjectStore((state) => state.provenance.curationMetadata.columns.length <= columnIndex + 1);
export const useProjectNumCurationColumns = () =>
    useProjectStore((state) => state.provenance.curationMetadata.columns.length);
export const useProjectCurationColumn = (columnIndex: number) =>
    useProjectStore((state) => state.provenance.curationMetadata.columns[columnIndex]);
export const useProjectCurationSources = () =>
    useProjectStore((state) => state.provenance.curationMetadata.identificationSources);
export const useProjectExtractionMetadata = () =>
    useProjectStore((state) => state.provenance.extractionMetadata);
export const useProjectFiltrationMetadata = () =>
    useProjectStore((state) => state.provenance.filtrationMetadata);
export const useProjectId = () => useProjectStore((state) => state.id);
export const useProjectAlgorithmMetadata = () =>
    useProjectStore((state) => state.provenance.algorithmMetadata);
export const useProjectCurationIsPrisma = () =>
    useProjectStore((state) => state.provenance.curationMetadata.prismaConfig.isPrisma);
export const useProjectCurationPrismaConfig = () =>
    useProjectStore((state) => state.provenance.curationMetadata.prismaConfig);
export const useProjectCurationInfoTags = () =>
    useProjectStore((state) => state.provenance.curationMetadata.infoTags);
export const useProjectCurationExclusionTags = () =>
    useProjectStore((state) => state.provenance.curationMetadata.exclusionTags);

// curation updater hooks
export const useUpdateProjectName = () => useProjectStore((state) => state.updateProjectName);
export const useUpdateProjectDescription = () =>
    useProjectStore((state) => state.updateProjectDescription);
export const useInitStore = () => useProjectStore((state) => state.initStore);
export const useClearProvenance = () => useProjectStore((state) => state.clearProvenance);
export const useHandleCurationDrag = () => useProjectStore((state) => state.handleDrag);
export const useCreateNewCurationInfoTag = () => useProjectStore((state) => state.createNewInfoTag);
export const useUpdateCurationColumns = () =>
    useProjectStore((state) => state.updateCurationColumns);
export const useAddNewCurationStubs = () => useProjectStore((state) => state.addNewStubs);
export const useInitCuration = () => useProjectStore((state) => state.initCuration);
export const useUpdateStubField = () => useProjectStore((state) => state.updateStubField);
export const usePromoteStub = () => useProjectStore((state) => state.promoteStub);
export const useCreateCurationSource = () =>
    useProjectStore((state) => state.createNewIdentificationSource);
export const useAddTagToStub = () => useProjectStore((state) => state.addTagToStub);
export const useRemoveTagFromStub = () => useProjectStore((state) => state.removeTagFromStub);
export const useSetExclusionFromStub = () => useProjectStore((state) => state.setExclusionForStub);
export const useCreateNewExclusion = () => useProjectStore((state) => state.createNewExclusion);

// extraction updater hooks
export const useUpdateExtractionMetadata = () =>
    useProjectStore((state) => state.updateExtractionMetadata);

// extraction retrieval hooks
export const useProjectExtractionStudysetId = () =>
    useProjectStore((state) => state.provenance.extractionMetadata.studysetId);
export const useProjectExtractionAnnotationId = () =>
    useProjectStore((state) => state.provenance.extractionMetadata.annotationId);
export const useProjectExtractionStudyStatusList = () =>
    useProjectStore((state) => state.provenance.extractionMetadata.studyStatusList);
