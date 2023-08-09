import { INeurosynthProject, INeurosynthProjectReturn } from 'interfaces/project/project.interface';
import { SnackbarMessage, OptionsObject, SnackbarKey } from 'notistack';
import API from 'utils/api';
import { create } from 'zustand';
import { TProjectStore } from './models';
import {
    initCurationHelper,
    handleDragEndHelper,
    createNewExclusionHelper,
    addTagToStubHelper,
    addNewStubsHelper,
    deleteStubHelper,
    updateStubFieldHelper,
    removeTagFromStubHelper,
    setExclusionForStubHelper,
    promoteStubHelper,
    promoteAllUncategorizedHelper,
    addOrUpdateStudyListStatusHelper,
    replaceStudyListStatusIdHelper,
    setGivenStudyStatusesAsCompleteHelper,
} from './utils';

const onUnloadHandler = (event: BeforeUnloadEvent) => {
    return (event.returnValue = 'Are you sure you want to leave?');
};

const useProjectStore = create<TProjectStore>()((set, get) => {
    return {
        // project
        name: '',
        id: undefined,
        meta_analyses: [],
        description: '',
        created_at: undefined,
        updated_at: undefined,
        user: undefined,
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
                imports: [],
            },
            extractionMetadata: {
                studysetId: undefined,
                annotationId: undefined,
                studyStatusList: [],
            },
            metaAnalysisMetadata: {
                canEditMetaAnalyses: false,
            },
        },

        metadata: {
            shouldUpdate: false,
            enqueueSnackbar: undefined,
            updateProject: undefined,
            logout: undefined,
            debounceTimeout: undefined,
            prevUpdatedProjectId: undefined,
            getProjectIsLoading: false,
            updateProjectIsLoading: false,
            isError: false,
            error: undefined,
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
                    imports: [],
                },
                extractionMetadata: {
                    studysetId: undefined,
                    annotationId: undefined,
                    studyStatusList: [],
                },
                metaAnalysisMetadata: {
                    canEditMetaAnalyses: false,
                },
            };
            const id = useProjectStore.getState().id;

            const res = await API.NeurosynthServices.ProjectsService.projectsIdPut(id || '', {
                provenance: emptyProvenance,
            });
            set((state) => ({
                ...state,
                provenance: {
                    ...emptyProvenance,
                },
                updated_at: res.data.updated_at,
                created_at: res.data.created_at,
            }));
        },
        updateProjectInDBDebounced: () => {
            const updateProject = get().metadata.updateProject;
            if (!updateProject) return;

            const storeData = get() as unknown as TProjectStore;
            if (!storeData.id) return;

            const existingTimeout = get().metadata.debounceTimeout;
            const prevId = get().metadata.prevUpdatedProjectId;

            if (existingTimeout && storeData.id === prevId) clearTimeout(existingTimeout);
            window.addEventListener('beforeunload', onUnloadHandler);

            const newTimeout = setTimeout(async () => {
                const { data } = await API.NeurosynthServices.ProjectsService.projectsIdGet(
                    storeData.id as string
                );

                const serverLastUpdated = data.updated_at;
                const localLastUpdated = storeData.updated_at;
                if (
                    serverLastUpdated &&
                    localLastUpdated &&
                    new Date(localLastUpdated).getTime() < new Date(serverLastUpdated).getTime()
                ) {
                    const enqueueSnackbar = storeData.metadata.enqueueSnackbar;
                    if (enqueueSnackbar) {
                        enqueueSnackbar(
                            'You are out of sync with the server and your changes will not be saved. Please refresh the page to get the latest data.',
                            { variant: 'error', persist: true }
                        );
                    }
                    window.removeEventListener('beforeunload', onUnloadHandler);
                    return;
                }

                const update: INeurosynthProject = {
                    name: storeData.name,
                    description: storeData.description,
                    provenance: {
                        ...storeData.provenance,
                    },
                };

                updateProject(
                    { projectId: storeData.id as string, project: update },
                    {
                        onSuccess: (res) => {
                            set((state) => ({
                                ...state,
                                updated_at: res.data.updated_at,
                            }));
                        },
                        onError: (err) => {
                            let enqueueSnackbarFunc:
                                | ((
                                      message: SnackbarMessage,
                                      options?: OptionsObject | undefined
                                  ) => SnackbarKey)
                                | undefined;
                            if (storeData.metadata.enqueueSnackbar) {
                                enqueueSnackbarFunc = storeData.metadata.enqueueSnackbar;
                            }

                            if (
                                err?.response?.data?.code &&
                                err?.response?.data?.code === 'token_expired'
                            ) {
                                if (enqueueSnackbarFunc) {
                                    enqueueSnackbarFunc(
                                        'Your login session has expired. We will now log you out.',
                                        { variant: 'error' }
                                    );
                                }

                                setTimeout(() => {
                                    const logout = storeData.metadata.logout;
                                    if (logout) logout();
                                }, 2000);
                            } else if (
                                err?.response?.data?.status &&
                                err?.response?.data?.status === 401
                            ) {
                                if (enqueueSnackbarFunc) {
                                    enqueueSnackbarFunc(
                                        'You must log in to make changes. Please log in and try again',
                                        { variant: 'error' }
                                    );
                                }
                            } else {
                                if (enqueueSnackbarFunc) {
                                    enqueueSnackbarFunc(
                                        'There was an error updating the project.',
                                        { variant: 'error' }
                                    );
                                }
                            }
                        },
                        onSettled: () => {
                            window.removeEventListener('beforeunload', onUnloadHandler);
                        },
                    }
                );
            }, 3000);

            set((state) => ({
                ...state,
                metadata: {
                    ...state.metadata,
                    prevUpdatedProjectId: storeData.id,
                    debounceTimeout: newTimeout,
                },
            }));
        },
        initProjectStore: async (project: INeurosynthProjectReturn | undefined) => {
            if (!project) return;

            set((state) => ({
                ...state,
                ...project,
            }));
        },
        updateProjectMetadata: (metadataUpdate) => {
            set((state) => ({
                ...state,
                metadata: {
                    ...state.metadata,
                    ...metadataUpdate,
                },
            }));
        },
        clearProjectStore: () => {
            set((state) => ({
                name: '',
                id: undefined,
                meta_analyses: [],
                description: '',
                user: undefined,
                updated_at: undefined,
                created_at: undefined,
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
                        imports: [],
                    },
                    extractionMetadata: {
                        studysetId: undefined,
                        annotationId: undefined,
                        studyStatusList: [],
                    },
                    metaAnalysisMetadata: {
                        canEditMetaAnalyses: false,
                    },
                },
                metadata: {
                    shouldUpdate: false,
                    enqueueSnackbar: undefined,
                    logout: undefined,
                    updateProject: undefined,
                    debounceTimeout: undefined,
                    prevUpdatedProjectId: undefined,
                    getProjectIsLoading: false,
                    updateProjectIsLoading: false,
                    isError: false,
                    error: undefined,
                },
            }));
        },
        initCuration: (cols: string[], isPrisma: boolean) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    curationMetadata: {
                        ...state.provenance.curationMetadata,
                        ...initCurationHelper(cols, isPrisma),
                    },
                },
                metadata: {
                    ...state.metadata,
                    shouldUpdate: true,
                },
            }));

            get().updateProjectInDBDebounced();
        },
        updateProjectName: (name: string) => {
            set((state) => ({
                ...state,
                name: name,
            }));

            get().updateProjectInDBDebounced();
        },
        updateProjectDescription: (description: string) => {
            set((state) => ({
                ...state,
                description: description,
            }));

            get().updateProjectInDBDebounced();
        },
        allowEditMetaAnalyses: () => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    metaAnalysisMetadata: {
                        ...state.provenance.metaAnalysisMetadata,
                        canEditMetaAnalyses: true,
                    },
                },
            }));

            get().updateProjectInDBDebounced();
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

            get().updateProjectInDBDebounced();
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

            get().updateProjectInDBDebounced();
        },
        createImport: (anImport) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    curationMetadata: {
                        ...state.provenance.curationMetadata,
                        imports: [...state.provenance.curationMetadata.imports, { ...anImport }],
                    },
                },
            }));

            get().updateProjectInDBDebounced();
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

            get().updateProjectInDBDebounced();
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

            get().updateProjectInDBDebounced();
        },
        deleteStub: (columnIndex, stubId) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    curationMetadata: {
                        ...state.provenance.curationMetadata,
                        columns: deleteStubHelper(
                            state.provenance.curationMetadata.columns,
                            columnIndex,
                            stubId
                        ),
                    },
                },
            }));

            get().updateProjectInDBDebounced();
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

            get().updateProjectInDBDebounced();
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

            get().updateProjectInDBDebounced();
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

            get().updateProjectInDBDebounced();
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

            get().updateProjectInDBDebounced();
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

            get().updateProjectInDBDebounced();
        },
        promoteAllUncategorized: () => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    curationMetadata: {
                        ...state.provenance.curationMetadata,
                        columns: promoteAllUncategorizedHelper(
                            state.provenance.curationMetadata.columns
                        ),
                    },
                },
            }));

            get().updateProjectInDBDebounced();
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

            get().updateProjectInDBDebounced();
        },
        addOrUpdateStudyListStatus: (id, status) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    extractionMetadata: {
                        ...state.provenance.extractionMetadata,
                        studyStatusList: [
                            ...addOrUpdateStudyListStatusHelper(
                                state.provenance.extractionMetadata.studyStatusList,
                                id,
                                status
                            ),
                        ],
                    },
                },
            }));

            get().updateProjectInDBDebounced();
        },
        replaceStudyListStatusId: (idToFindAndReplace, replaceWithId) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    extractionMetadata: {
                        ...state.provenance.extractionMetadata,
                        studyStatusList: [
                            ...replaceStudyListStatusIdHelper(
                                state.provenance.extractionMetadata.studyStatusList,
                                idToFindAndReplace,
                                replaceWithId
                            ),
                        ],
                    },
                },
            }));
            get().updateProjectInDBDebounced();
        },
        setGivenStudyStatusesAsComplete: (studyIdList: string[]) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    extractionMetadata: {
                        ...state.provenance.extractionMetadata,
                        studyStatusList: [...setGivenStudyStatusesAsCompleteHelper(studyIdList)],
                    },
                },
            }));

            get().updateProjectInDBDebounced();
        },
    };
});

export default useProjectStore;
