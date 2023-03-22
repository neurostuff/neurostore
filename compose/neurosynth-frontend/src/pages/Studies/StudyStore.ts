import { IMetadataRowModel } from 'components/EditMetadata';
import {
    arrayToMetadata,
    metadataToArray,
} from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import { StudyReturn } from 'neurostore-typescript-sdk';
import API from 'utils/api';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreStudy extends Omit<StudyReturn, 'metadata'> {
    metadata: IMetadataRowModel[];
}

export type StudyDetails = Pick<
    StudyReturn,
    'name' | 'description' | 'publication' | 'authors' | 'doi' | 'pmid' | 'year'
>;

export type StudyStoreActions = {
    initStudyStore: (studyId?: string) => void;
    clearStudyStore: () => void;
    updateStudy: (fieldName: keyof StudyDetails, value: string | number) => void;
    updateStudyInDB: () => Promise<void>;
    addOrUpdateStudyMetadataRow: (row: IMetadataRowModel) => void;
    deleteStudyMetadataRow: (key: string) => void;
};

type StudyStoreMetadata = {
    isEdited: boolean;
    isError: boolean;
    isLoading: boolean;
};

const useStudyStore = create<StoreStudy & StudyStoreMetadata & StudyStoreActions>()(
    persist(
        (set) => {
            return {
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

                isEdited: false,
                isLoading: false,
                isError: false,

                initStudyStore: async (studyId) => {
                    console.log('updating');
                    if (!studyId) return;
                    set((state) => ({
                        ...state,
                        isLoading: true,
                    }));
                    try {
                        const res = await API.NeurostoreServices.StudiesService.studiesIdGet(
                            studyId
                        );
                        set((state) => ({
                            ...state,
                            ...res.data,
                            metadata: metadataToArray(res?.data?.metadata || {}),
                            isEdited: false,
                            isLoading: false,
                        }));
                    } catch (e) {
                        set((state) => ({
                            ...state,
                            isLoading: false,
                            isError: true,
                        }));
                    }
                },
                clearStudyStore: () => {
                    set((state) => ({
                        ...state,
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

                        isEdited: false,
                    }));
                },
                updateStudy: (fieldName, value) => {
                    set((state) => ({
                        ...state,
                        [fieldName]: value,
                        isEdited: true,
                    }));
                },
                updateStudyInDB: async () => {
                    try {
                        const state = useStudyStore.getState();
                        if (!state.id) throw new Error('no study id');
                        set((state) => ({
                            ...state,
                            isLoading: true,
                        }));
                        const res = await API.NeurostoreServices.StudiesService.studiesIdPut(
                            state.id,
                            {
                                name: state.name,
                                description: state.description,
                                doi: state.doi,
                                pmid: state.pmid,
                                authors: state.authors,
                                year: state.year,
                                publication: state.publication,
                                metadata: arrayToMetadata(state.metadata),
                            }
                        );
                        set((state) => ({
                            ...state,
                            isEdited: false,
                            isLoading: false,
                        }));
                    } catch (e) {
                        set((state) => ({
                            ...state,
                            isLoading: false,
                            isError: true,
                        }));
                        throw new Error('error updating study');
                    }
                },
                addOrUpdateStudyMetadataRow: (row) => {
                    set((state) => {
                        const update = [...state.metadata];
                        const foundRowIndex = update.findIndex(
                            (x) => x.metadataKey === row.metadataKey
                        );
                        if (foundRowIndex < 0) {
                            update.unshift({
                                ...row,
                            });
                        } else {
                            update[foundRowIndex] = {
                                ...update[foundRowIndex],
                                ...row,
                            };
                        }

                        return {
                            ...state,
                            metadata: update,
                            isEdited: true,
                        };
                    });
                },
                deleteStudyMetadataRow: (id) => {
                    set((state) => {
                        const update = [...state.metadata];
                        const foundRowIndex = update.findIndex((x) => x.metadataKey === id);
                        if (foundRowIndex < 0) return state;

                        update.splice(foundRowIndex, 1);

                        return {
                            ...state,
                            metadata: update,
                            isEdited: true,
                        };
                    });
                },
            };
        },
        {
            name: 'neurosynth',
        }
    )
);

// study retrieval hooks
export const useStudyId = () => useStudyStore((state) => state.id);
export const useStudyIsLoading = () => useStudyStore((state) => state.isLoading);
export const useStudyDetails = () =>
    useStudyStore(
        (state) =>
            ({
                name: state.name,
                description: state.description,
                authors: state.authors,
                publication: state.publication,
                doi: state.doi,
                year: state.year,
                pmid: state.pmid,
            } as StudyDetails)
    );
export const useIsEdited = () => useStudyStore((state) => state.isEdited);
export const useStudyMetadata = () => useStudyStore((state) => state.metadata);
export const useStudyAnalyses = () => useStudyStore((state) => state.analyses);

// study action hooks
export const useInitStudyStore = () => useStudyStore((state) => state.initStudyStore);
export const useClearStudyStore = () => useStudyStore((state) => state.clearStudyStore);
export const useUpdateStudyDetails = () => useStudyStore((state) => state.updateStudy);
export const useUpdateStudyInDB = () => useStudyStore((state) => state.updateStudyInDB);
export const useAddOrUpdateMetadata = () =>
    useStudyStore((state) => state.addOrUpdateStudyMetadataRow);
export const useDeleteMetadataRow = () => useStudyStore((state) => state.deleteStudyMetadataRow);
// export type ProjectStoreActions = {
//     updateProjectName: (name: string) => void;
//     updateProjectDescription: (description: string) => void;
//     initProjectStore: (projectId: string | undefined) => void;
//     initCuration: (cols: string[], isPrisma: boolean) => void;
//     handleDrag: (result: DropResult, provided: ResponderProvided) => void;
//     createNewExclusion: (
// };

// const useProjectStore = create<INeurosynthProjectReturn & ProjectStoreActions>()(
//     apiDebouncedUpdaterImplMiddleware(
//         persist(
//             (set) => {
//                 return {
//                     // project
//                     name: '',
//                     id: undefined,
//                     meta_analyses: [],
//                     description: '',
//                     provenance: {
//                         curationMetadata: {
//                             columns: [],
//                             prismaConfig: {
//                                 isPrisma: false,
//                                 identification: {
//                                     exclusionTags: [],
//                                 },
//                                 screening: {
//                                     exclusionTags: [],
//                                 },
//                                 eligibility: {
//                                     exclusionTags: [],
//                                 },
//                             },
//                             infoTags: [],
//                             exclusionTags: [],
//                             identificationSources: [],
//                         },
//                         extractionMetadata: {
//                             studysetId: undefined,
//                             annotationId: undefined,
//                             studyStatusList: [],
//                         },
//                         filtrationMetadata: {
//                             filter: {
//                                 filtrationKey: undefined,
//                                 type: EPropertyType.NONE,
//                             },
//                         },
//                         algorithmMetadata: {
//                             specificationId: undefined,
//                         },
//                     },

//                     // just for testing purposes
//                     clearProvenance: async () => {
//                         const emptyProvenance = {
//                             curationMetadata: {
//                                 columns: [],
//                                 prismaConfig: {
//                                     isPrisma: false,
//                                     identification: {
//                                         exclusionTags: [],
//                                     },
//                                     screening: {
//                                         exclusionTags: [],
//                                     },
//                                     eligibility: {
//                                         exclusionTags: [],
//                                     },
//                                 },
//                                 infoTags: [],
//                                 exclusionTags: [],
//                                 identificationSources: [],
//                             },
//                             extractionMetadata: {
//                                 studysetId: undefined,
//                                 annotationId: undefined,
//                                 studyStatusList: [],
//                             },
//                             filtrationMetadata: {
//                                 filter: {
//                                     filtrationKey: undefined,
//                                     type: EPropertyType.NONE,
//                                 },
//                             },
//                             algorithmMetadata: {
//                                 specificationId: undefined,
//                             },
//                         };
//                         const id = useProjectStore.getState().id;

//                         await API.NeurosynthServices.ProjectsService.projectsIdPut(id || '', {
//                             provenance: emptyProvenance,
//                         });
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...emptyProvenance,
//                             },
//                         }));
//                     },
//                     initProjectStore: async (projectId: string | undefined) => {
//                         if (!projectId) return;

//                         const currId = useProjectStore.getState().id;
//                         if (currId !== projectId) {
//                             const res = (await API.NeurosynthServices.ProjectsService.projectsIdGet(
//                                 projectId
//                             )) as AxiosResponse<INeurosynthProjectReturn>;
//                             set((state) => ({
//                                 ...state,
//                                 ...res.data,
//                             }));
//                         }
//                     },
//                     initCuration: (cols: string[], isPrisma: boolean) => {
//                         set((state) => {
//                             const update = {
//                                 ...state,
//                                 provenance: {
//                                     ...state.provenance,
//                                     curationMetadata: {
//                                         ...state.provenance.curationMetadata,
//                                         ...initCurationHelper(cols, isPrisma),
//                                     },
//                                 },
//                             };
//                             return update;
//                         });
//                     },
//                     updateProjectName: (name: string) => {
//                         set((state) => ({
//                             ...state,
//                             name: name,
//                         }));
//                     },
//                     updateProjectDescription: (description: string) => {
//                         set((state) => ({
//                             ...state,
//                             description: description,
//                         }));
//                     },
//                     handleDrag: (result, provided) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...state.provenance.curationMetadata,
//                                     columns: handleDragEndHelper(
//                                         state.provenance.curationMetadata.columns,
//                                         result,
//                                         provided
//                                     ),
//                                 },
//                             },
//                         }));
//                     },
//                     createNewExclusion: (newExclusion, phase) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...createNewExclusionHelper(
//                                         state.provenance.curationMetadata,
//                                         newExclusion,
//                                         phase
//                                     ),
//                                 },
//                             },
//                         }));
//                     },
//                     createNewInfoTag: (newTag: ITag) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...state.provenance.curationMetadata,
//                                     infoTags: [
//                                         ...state.provenance.curationMetadata.infoTags,
//                                         { ...newTag },
//                                     ],
//                                 },
//                             },
//                         }));
//                     },
//                     addTagToStub: (columnIndex, stubId, newTag) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...state.provenance.curationMetadata,
//                                     columns: addTagToStubHelper(
//                                         state.provenance.curationMetadata.columns,
//                                         columnIndex,
//                                         stubId,
//                                         newTag
//                                     ),
//                                 },
//                             },
//                         }));
//                     },
//                     createNewIdentificationSource: (newSource: ISource) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...state.provenance.curationMetadata,
//                                     identificationSources: [
//                                         ...state.provenance.curationMetadata.identificationSources,
//                                         { ...newSource },
//                                     ],
//                                 },
//                             },
//                         }));
//                     },
//                     addNewStubs: (stubs) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...state.provenance.curationMetadata,
//                                     columns: addNewStubsHelper(
//                                         state.provenance.curationMetadata.columns,
//                                         stubs
//                                     ),
//                                 },
//                             },
//                         }));
//                     },
//                     updateCurationColumns(columns) {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...state.provenance.curationMetadata,
//                                     columns: columns,
//                                 },
//                             },
//                         }));
//                     },
//                     updateStubField: (columnIndex, stubId, field, value) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...state.provenance.curationMetadata,
//                                     columns: updateStubFieldHelper(
//                                         state.provenance.curationMetadata.columns,
//                                         columnIndex,
//                                         stubId,
//                                         field,
//                                         value
//                                     ),
//                                 },
//                             },
//                         }));
//                     },
//                     removeTagFromStub: (columnIndex, stubId, tagId) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...state.provenance.curationMetadata,
//                                     columns: removeTagFromStubHelper(
//                                         state.provenance.curationMetadata.columns,
//                                         columnIndex,
//                                         stubId,
//                                         tagId
//                                     ),
//                                 },
//                             },
//                         }));
//                     },
//                     setExclusionForStub: (columnIndex, stubId, exclusion) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...state.provenance.curationMetadata,
//                                     columns: setExclusionForStubHelper(
//                                         state.provenance.curationMetadata.columns,
//                                         columnIndex,
//                                         stubId,
//                                         exclusion
//                                     ),
//                                 },
//                             },
//                         }));
//                     },
//                     promoteStub: (columnIndex, stubId) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 curationMetadata: {
//                                     ...state.provenance.curationMetadata,
//                                     columns: promoteStubHelper(
//                                         state.provenance.curationMetadata.columns,
//                                         columnIndex,
//                                         stubId
//                                     ),
//                                 },
//                             },
//                         }));
//                     },
//                     updateExtractionMetadata: (metadata) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 extractionMetadata: {
//                                     ...state.provenance.extractionMetadata,
//                                     ...metadata,
//                                 },
//                             },
//                         }));
//                     },
//                     addOrUpdateStudyListStatus: (id, status) => {
//                         set((state) => ({
//                             ...state,
//                             provenance: {
//                                 ...state.provenance,
//                                 extractionMetadata: {
//                                     ...state.provenance.extractionMetadata,
//                                     studyStatusList: [
//                                         ...addOrUpdateStudyListStatusHelper(
//                                             state.provenance.extractionMetadata.studyStatusList,
//                                             id,
//                                             status
//                                         ),
//                                     ],
//                                 },
//                             },
//                         }));
//                     },
//                 };
//             },
//             {
//                 name: 'neurosynth-project',
//             }
//         ),
//         'neurosynth-store'
//     )
// );
