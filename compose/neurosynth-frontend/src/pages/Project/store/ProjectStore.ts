import { useAuth0 } from '@auth0/auth0-react';
import { setUnloadHandler, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import useGetProjectById from 'hooks/projects/useGetProjectById';
import { INeurosynthProject, INeurosynthProjectReturn, ISource, ITag } from 'hooks/projects/useGetProjects';
import useUpdateProject from 'hooks/projects/useUpdateProject';
import { useSnackbar } from 'notistack';
import {
    addNewStubsHelper,
    addOrUpdateStudyListStatusHelper,
    addTagToStubHelper,
    createNewExclusionHelper,
    demoteStubHelper,
    getExclusionsHelper,
    handleDragEndHelper,
    initCurationHelper,
    promoteAllUncategorizedHelper,
    promoteStubHelper,
    removeTagFromStubHelper,
    replaceStudyListStatusIdHelper,
    setExclusionForStubHelper,
    setGivenStudyStatusesAsCompleteHelper,
    updateExclusionTagHelper,
    updateStubFieldHelper,
} from 'pages/Project/store/ProjectStore.helpers';
import { useEffect } from 'react';
import { useQueryClient } from 'react-query';
import { useParams } from 'react-router-dom';
import API from 'utils/api';
import { create } from 'zustand';
import { TProjectStore } from './ProjectStore.types';

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
                identificationSources: [],
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
            enqueueSnackbar: undefined,
            updateProject: undefined,
            logout: undefined,
            debounceTimeout: undefined,
            prevUpdatedProjectId: undefined,
            getProjectIsLoading: false,
            updateProjectIsLoading: false,
            isError: false,
            error: undefined,
            hasUnsavedChanges: false,
            queryClient: undefined,
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
        updateProjectMetaAnalyses: (meta_analyses: string[]) => {
            set((state) => ({
                ...state,
                meta_analyses: meta_analyses,
            }));
        },
        updateProjectInDBDebounced: () => {
            const updateProject = get().metadata.updateProject;
            if (!updateProject) return;

            const oldDebouncedStoreData = get() as unknown as TProjectStore;
            if (!oldDebouncedStoreData.id) return;

            const existingTimeout = get().metadata.debounceTimeout;
            const prevId = get().metadata.prevUpdatedProjectId;

            if (existingTimeout && oldDebouncedStoreData.id === prevId) clearTimeout(existingTimeout);
            setUnloadHandler('project');

            const newTimeout = setTimeout(async () => {
                let enqueueSnackbar = oldDebouncedStoreData.metadata.enqueueSnackbar;
                if (!enqueueSnackbar) {
                    // set some noop if func does not exist
                    // note: this should never happen - something has gone wrong!
                    enqueueSnackbar = (m: any, o: any) => 0;
                    console.error('no snackbar function defined!');
                }

                try {
                    const { data } = await API.NeurosynthServices.ProjectsService.projectsIdGet(
                        oldDebouncedStoreData.id as string
                    );

                    // we use the latest data instead of oldDebouncedStoreData because we don't care whether
                    // the debounced last_updated is up to date, we just care that the overall store is up to date.

                    // This fixes a bug where we would get "out of sync" errors when a user updated the curation UI just as
                    // the anonymous setTimeout function executed from a previous update (probably during the GET above): the serverLastUpdated value was compared
                    // to the just recently out of date oldDebouncedStoreData last updated value which then caused the "out of sync" snackbar to appear
                    const latestStoreDataLastUpdated = get().updated_at;
                    const serverLastUpdated = data.updated_at;

                    if (
                        serverLastUpdated &&
                        latestStoreDataLastUpdated &&
                        new Date(latestStoreDataLastUpdated).getTime() !== new Date(serverLastUpdated).getTime()
                    ) {
                        const enqueueSnackbar = oldDebouncedStoreData.metadata.enqueueSnackbar;
                        if (enqueueSnackbar) {
                            enqueueSnackbar(
                                'You are out of sync with the server and your changes will not be saved. Please refresh the page to get the latest data.',
                                { variant: 'error', persist: true }
                            );
                        }
                        unsetUnloadHandler('project');
                        return;
                    }

                    const update: INeurosynthProject = {
                        name: oldDebouncedStoreData.name,
                        description: oldDebouncedStoreData.description,
                        public: oldDebouncedStoreData.public,
                        provenance: {
                            ...oldDebouncedStoreData.provenance,
                        },
                    };

                    updateProject(
                        { projectId: oldDebouncedStoreData.id as string, project: update },
                        {
                            onSuccess: (res) => {
                                set((state) => ({
                                    ...state,
                                    updated_at: res.data.updated_at,
                                    metadata: {
                                        ...state.metadata,
                                        hasUnsavedChanges: false,
                                    },
                                }));
                            },
                            onError: (err) => {
                                if (err?.response?.data?.code && err?.response?.data?.code === 'token_expired') {
                                    enqueueSnackbar('Your login session has expired. We will now log you out.', {
                                        variant: 'error',
                                    });

                                    setTimeout(() => {
                                        const logout = oldDebouncedStoreData.metadata.logout;
                                        if (logout) logout();
                                    }, 2000);
                                } else if (err?.response?.data?.status && err?.response?.data?.status === 401) {
                                    enqueueSnackbar('You must log in to make changes. Please log in and try again', {
                                        variant: 'error',
                                    });
                                } else {
                                    console.error(err);
                                    throw new Error(err.response?.data?.message);
                                }
                            },
                            onSettled: () => {
                                unsetUnloadHandler('project');
                            },
                        }
                    );
                } catch (e) {
                    enqueueSnackbar(
                        'There was an error updating the project. Please refresh the page, otherwise your changes will not be saved',
                        { variant: 'error' }
                    );

                    set((state) => ({
                        ...state,
                        metadata: {
                            ...state.metadata,
                            isError: true,
                            hasUnsavedChanges: true,
                        },
                    }));

                    console.error(e);
                }
            }, 2500);

            set((state) => ({
                ...state,
                metadata: {
                    ...state.metadata,
                    prevUpdatedProjectId: oldDebouncedStoreData.id,
                    debounceTimeout: newTimeout,
                    hasUnsavedChanges: true,
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
            set(() => ({
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
                        identificationSources: [],
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
                    enqueueSnackbar: undefined,
                    logout: undefined,
                    updateProject: undefined,
                    debounceTimeout: undefined,
                    prevUpdatedProjectId: undefined,
                    getProjectIsLoading: false,
                    updateProjectIsLoading: false,
                    isError: false,
                    error: undefined,
                    hasUnsavedChanges: false,
                    queryClient: undefined,
                },
            }));
        },
        initCuration: (cols, isPrisma) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    curationMetadata: {
                        ...state.provenance.curationMetadata,
                        ...initCurationHelper(cols, isPrisma),
                    },
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
        updateProjectIsPublic: (isPublic: boolean) => {
            set((state) => ({
                ...state,
                public: isPublic,
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
        allowEditMetaAnalyses: (allowed: boolean) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    metaAnalysisMetadata: {
                        ...state.provenance.metaAnalysisMetadata,
                        canEditMetaAnalyses: allowed,
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
                        columns: handleDragEndHelper(state.provenance.curationMetadata.columns, result, provided),
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
                        ...createNewExclusionHelper(state.provenance.curationMetadata, newExclusion, phase),
                    },
                },
            }));

            get().updateProjectInDBDebounced();
        },
        createNewInfoTag: (newTag: ITag) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    curationMetadata: {
                        ...state.provenance.curationMetadata,
                        infoTags: [...state.provenance.curationMetadata.infoTags, { ...newTag }],
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

            get().updateProjectInDBDebounced();
        },
        addNewStubs: (stubs) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    curationMetadata: {
                        ...state.provenance.curationMetadata,
                        columns: addNewStubsHelper(state.provenance.curationMetadata.columns, stubs),
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
        createNewCurationImport(newCurationImport) {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    curationMetadata: {
                        ...state.provenance.curationMetadata,
                        imports: [...(state.provenance.curationMetadata.imports || []), newCurationImport],
                    },
                },
            }));

            get().updateProjectInDBDebounced();
        },
        updateExclusionTag: (exclusionIdToUpdate, newName) => {
            set((state) => {
                return {
                    ...state,
                    provenance: updateExclusionTagHelper(state.provenance, exclusionIdToUpdate, newName),
                };
            });

            get().updateProjectInDBDebounced();
        },
        deleteCurationImport(importId) {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    curationMetadata: {
                        ...state.provenance.curationMetadata,
                        columns: state.provenance.curationMetadata.columns.map((col) => {
                            return {
                                ...col,
                                stubStudies: col.stubStudies.filter((stub) => stub.importId !== importId),
                            };
                        }),
                        imports: state.provenance.curationMetadata.imports.filter((x) => x.id !== importId),
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
        setExclusionForStub: (columnIndex, stubId, exclusionId) => {
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
                            exclusionId
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
                        columns: promoteStubHelper(state.provenance.curationMetadata.columns, columnIndex, stubId),
                    },
                },
            }));

            get().updateProjectInDBDebounced();
        },
        demoteStub: (columnIndex, stubId) => {
            set((state) => ({
                ...state,
                provenance: {
                    ...state.provenance,
                    curationMetadata: {
                        ...state.provenance.curationMetadata,
                        columns: demoteStubHelper(state.provenance.curationMetadata.columns, columnIndex, stubId),
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
                        columns: promoteAllUncategorizedHelper(state.provenance.curationMetadata.columns),
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

// project metadata retrieval hooks
export const useProjectMetadataHasUnsavedchanges = () => useProjectStore((state) => state.metadata.hasUnsavedChanges);

// higher level project retrieval hooks
export const useProjectIsPublic = () => useProjectStore((state) => state.public);
export const useProjectCreatedAt = () =>
    useProjectStore((state) => (state.created_at ? new Date(state.created_at || '') : undefined));
export const useProjectUpdatedAt = () =>
    useProjectStore((state) => (state.updated_at ? new Date(state.updated_at || '') : undefined));
export const useProjectName = () => useProjectStore((state) => state.name);
export const useProjectDescription = () => useProjectStore((state) => state.description);
export const useProjectProvenance = () => useProjectStore((state) => state.provenance);
export const useGetProjectIsLoading = () => useProjectStore((state) => state.metadata.getProjectIsLoading);
export const useUpdateProjectIsLoading = () => useProjectStore((state) => state.metadata.updateProjectIsLoading);
export const useProjectIsError = () => useProjectStore((state) => state.metadata.isError);
export const useProjectUser = () => useProjectStore((state) => state.user);
export const useProjectUsername = () => useProjectStore((state) => state.username);
export const useProjectMetaAnalyses = () => useProjectStore((state) => state.meta_analyses);

// curation retrieval hooks
export const useProjectCurationColumns = () => useProjectStore((state) => state.provenance.curationMetadata.columns);
export const useProjectExclusionTags = () =>
    useProjectStore((state) => {
        return getExclusionsHelper(state.provenance);
    });
export const useProjectExclusionTag = (exclusionTagId: string | null) => {
    const exclusionTags = useProjectExclusionTags();
    if (exclusionTagId === null) return null;
    return exclusionTags.find((tag) => tag.id === exclusionTagId);
};
export const useProjectCurationIsLastColumn = (columnIndex: number) =>
    useProjectStore((state) => state.provenance.curationMetadata.columns.length <= columnIndex + 1);
export const useProjectNumCurationColumns = () =>
    useProjectStore((state) => state.provenance.curationMetadata.columns.length);
export const useProjectCurationColumn = (columnIndex: number) =>
    useProjectStore((state) => state.provenance.curationMetadata.columns[columnIndex]);
export const useProjectCurationSources = () =>
    useProjectStore((state) => state.provenance.curationMetadata.identificationSources);
export const useProjectExtractionMetadata = () => useProjectStore((state) => state.provenance.extractionMetadata);
export const useProjectId = () => useProjectStore((state) => state.id);
export const useProjectCurationIsPrisma = () =>
    useProjectStore((state) => state.provenance.curationMetadata.prismaConfig.isPrisma);
export const useProjectCurationPrismaConfig = () =>
    useProjectStore((state) => state.provenance.curationMetadata.prismaConfig);
export const useProjectCurationInfoTags = () => useProjectStore((state) => state.provenance.curationMetadata.infoTags);
export const useProjectCurationExclusionTags = () =>
    useProjectStore((state) => state.provenance.curationMetadata.exclusionTags);
export const useProjectCurationImports = () =>
    useProjectStore((state) => state.provenance.curationMetadata.imports || []);
export const useProjectCurationImport = (importId: string) =>
    useProjectStore((state) =>
        state.provenance.curationMetadata.imports.find((curationImport) => curationImport.id === importId)
    );
export const useProjectGetColumnForStub = (stubId: string) =>
    useProjectStore((state) => {
        const colIndex = state.provenance.curationMetadata.columns.findIndex((col) =>
            col.stubStudies.find((stub) => stub.id === stubId)
        );

        if (colIndex < 0) {
            return {
                column: undefined,
                columnIndex: -1,
            };
        }

        return {
            columnIndex: colIndex,
            column: state.provenance.curationMetadata.columns[colIndex],
        };
    });

export const useProjectCurationDuplicates = () =>
    useProjectStore((state) => {
        if (!state.provenance.curationMetadata.prismaConfig.isPrisma) return [];
        return state.provenance.curationMetadata.columns[0].stubStudies.filter((x) => x.exclusionTagId !== null);
    });

// curation updater hooks
export const useUpdateProjectIsPublic = () => useProjectStore((state) => state.updateProjectIsPublic);
export const useUpdateProjectName = () => useProjectStore((state) => state.updateProjectName);
export const useUpdateProjectDescription = () => useProjectStore((state) => state.updateProjectDescription);
export const useInitProjectStore = () => useProjectStore((state) => state.initProjectStore);
export const useClearProjectStore = () => useProjectStore((state) => state.clearProjectStore);
export const useClearProvenance = () => useProjectStore((state) => state.clearProvenance);
export const useHandleCurationDrag = () => useProjectStore((state) => state.handleDrag);
export const useCreateNewCurationInfoTag = () => useProjectStore((state) => state.createNewInfoTag);
export const useUpdateCurationColumns = () => useProjectStore((state) => state.updateCurationColumns);
export const useCreateNewCurationImport = () => useProjectStore((state) => state.createNewCurationImport);
export const useDeleteCurationImport = () => useProjectStore((state) => state.deleteCurationImport);
export const useAddNewCurationStubs = () => useProjectStore((state) => state.addNewStubs);
export const useUpdateStubField = () => useProjectStore((state) => state.updateStubField);
export const usePromoteStub = () => useProjectStore((state) => state.promoteStub);
export const useDemoteStub = () => useProjectStore((state) => state.demoteStub);
export const usePromoteAllUncategorized = () => useProjectStore((state) => state.promoteAllUncategorized);
export const useCreateCurationSource = () => useProjectStore((state) => state.createNewIdentificationSource);
export const useAddTagToStub = () => useProjectStore((state) => state.addTagToStub);
export const useRemoveTagFromStub = () => useProjectStore((state) => state.removeTagFromStub);
export const useSetExclusionForStub = () => useProjectStore((state) => state.setExclusionForStub);
export const useCreateNewExclusion = () => useProjectStore((state) => state.createNewExclusion);
export const useUpdateProjectMetadata = () => useProjectStore((state) => state.updateProjectMetadata);
export const useInitCuration = () => useProjectStore((state) => state.initCuration);
export const useUpdateExclusionTag = () => useProjectStore((state) => state.updateExclusionTag);

export const useInitProjectStoreIfRequired = () => {
    const clearProjectStore = useClearProjectStore();
    const initProjectStore = useInitProjectStore();
    const updateProjectMetadata = useUpdateProjectMetadata();
    const projectIdFromProject = useProjectId();

    const { enqueueSnackbar } = useSnackbar();

    const { logout } = useAuth0();

    const { projectId } = useParams<{ projectId: string; studyId: string }>();
    const queryClient = useQueryClient();

    const { mutate, isLoading: useUpdateProjectIsLoading, isError: useUpdateProjectIsError } = useUpdateProject();
    const { data, isLoading: getProjectIsLoading, isError: getProjectIsError } = useGetProjectById(projectId);

    const isError = useUpdateProjectIsError || getProjectIsError;

    useEffect(() => {
        if (projectId && projectId !== projectIdFromProject && data) {
            clearProjectStore();
            initProjectStore(data);
            updateProjectMetadata({
                updateProject: mutate,
                logout: logout,
                enqueueSnackbar: enqueueSnackbar,
                getProjectIsLoading: getProjectIsLoading,
                updateProjectIsLoading: useUpdateProjectIsLoading,
                isError: isError,
                queryClient: queryClient,
            });
        } else {
            updateProjectMetadata({
                updateProject: mutate, // must pass in mutate func as it gets redefined when component unmounts
                getProjectIsLoading: getProjectIsLoading,
                updateProjectIsLoading: useUpdateProjectIsLoading,
                isError: isError,
                queryClient: queryClient,
            });
        }
    }, [
        clearProjectStore,
        enqueueSnackbar,
        initProjectStore,
        logout,
        mutate,
        updateProjectMetadata,
        data,
        getProjectIsLoading,
        isError,
        projectId,
        projectIdFromProject,
        useUpdateProjectIsLoading,
        queryClient,
    ]);
};

// extraction updater hooks
export const useUpdateExtractionMetadata = () => useProjectStore((state) => state.updateExtractionMetadata);

// extraction retrieval hooks
export const useProjectExtractionStudysetId = () =>
    useProjectStore((state) => state.provenance.extractionMetadata.studysetId);
export const useProjectExtractionAnnotationId = () =>
    useProjectStore((state) => state.provenance.extractionMetadata.annotationId);
export const useProjectExtractionStudyStatusList = () =>
    useProjectStore((state) => state.provenance.extractionMetadata.studyStatusList);
export const useProjectExtractionStudyStatus = (studyId: string) =>
    useProjectStore((state) => state.provenance.extractionMetadata.studyStatusList.find((x) => x.id === studyId));
export const useProjectExtractionAddOrUpdateStudyListStatus = () =>
    useProjectStore((state) => state.addOrUpdateStudyListStatus);
export const useProjectExtractionReplaceStudyListStatusId = () =>
    useProjectStore((state) => state.replaceStudyListStatusId);
export const useProjectExtractionSetGivenStudyStatusesAsComplete = () =>
    useProjectStore((state) => state.setGivenStudyStatusesAsComplete);

// metaAnalysisAlgorithm updater hooks
export const useAllowEditMetaAnalyses = () => useProjectStore((state) => state.allowEditMetaAnalyses);
export const useUpdateProjectMetaAnalyses = () => useProjectStore((state) => state.updateProjectMetaAnalyses);

// metaAnalysisAlgorithm retrieval hooks
export const useProjectMetaAnalysisCanEdit = () =>
    useProjectStore((state) => state?.provenance?.metaAnalysisMetadata?.canEditMetaAnalyses);
