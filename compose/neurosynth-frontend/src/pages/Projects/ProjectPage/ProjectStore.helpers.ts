import { DropResult, ResponderProvided } from '@hello-pangea/dnd';
import {
    ICurationMetadata,
    INeurosynthProject,
    INeurosynthProjectReturn,
    IPRISMAConfig,
    ISource,
    IStudyExtractionStatus,
    ITag,
} from 'hooks/requests/useGetProjects';
import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import {
    ENeurosynthSourceIds,
    ENeurosynthTagIds,
} from 'components/ProjectStepComponents/CurationStep/CurationStep';
import { v4 as uuidv4 } from 'uuid';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { ProjectStoreActions } from './ProjectStore';
import API from 'utils/api';

export const defaultIdentificationSources = {
    neurostore: {
        id: ENeurosynthSourceIds.NEUROSTORE,
        label: 'Neurostore',
    },
    pubmed: {
        id: ENeurosynthSourceIds.PUBMED,
        label: 'PubMed',
    },
    scopus: {
        id: ENeurosynthSourceIds.SCOPUS,
        label: 'Scopus',
    },
    webOfScience: {
        id: ENeurosynthSourceIds.WEBOFSCIENCE,
        label: 'Web of Science',
    },
    psycInfo: {
        id: ENeurosynthSourceIds.PSYCINFO,
        label: 'PsycInfo',
    },
};

export const defaultExclusionTags = {
    exclusion: {
        id: ENeurosynthTagIds.EXCLUDE_EXCLUSION_ID,
        label: 'Exclude',
        isExclusionTag: true,
        isAssignable: true,
    },
    duplicate: {
        id: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID,
        label: 'Duplicate',
        isExclusionTag: true,
        isAssignable: true,
    },
};

export const defaultInfoTags = {
    untagged: {
        id: ENeurosynthTagIds.UNTAGGED_TAG_ID,
        label: 'Untagged studies',
        isExclusionTag: false,
        isAssignable: false,
    },
    uncategorized: {
        id: ENeurosynthTagIds.UNCATEGORIZED_ID,
        label: 'Uncategorized Studies',
        isExclusionTag: false,
        isAssignable: false,
    },
    needsReview: {
        id: ENeurosynthTagIds.NEEDS_REVIEW_TAG_ID,
        label: 'Needs Review',
        isExclusionTag: false,
        isAssignable: false,
    },
};

export const handleDragEndHelper = (
    state: ICurationColumn[],
    result: DropResult,
    provided: ResponderProvided
): ICurationColumn[] => {
    const { destination, source, draggableId } = result;
    // don't do anything if not dropped to a valid destination, or if the draggable was not moved
    if (
        !destination ||
        (destination.droppableId === source.droppableId && destination.index === source.index)
    ) {
        return state;
    }

    const updatedState = [...state];

    // drop item in the same column but different place
    if (source.droppableId === destination.droppableId) {
        const colIndex = updatedState.findIndex((col) => col.id === source.droppableId);
        if (colIndex < 0) return state;

        const updatedStubStudiesList = [...updatedState[colIndex].stubStudies];
        const draggable = updatedStubStudiesList[source.index];
        updatedStubStudiesList.splice(source.index, 1);
        updatedStubStudiesList.splice(destination.index, 0, draggable);

        updatedState[colIndex] = {
            ...updatedState[colIndex],
            stubStudies: updatedStubStudiesList,
        };
    } else {
        // drop item in a different column
        const startColIndex = updatedState.findIndex((col) => col.id === source.droppableId);
        const endColIndex = updatedState.findIndex((col) => col.id === destination.droppableId);

        if (startColIndex < 0 || endColIndex < 0) return state;

        const updatedStartColStubStudiesList = [...updatedState[startColIndex].stubStudies];
        const draggable = updatedStartColStubStudiesList[source.index];
        updatedStartColStubStudiesList.splice(source.index, 1);
        const updatedStartCol = {
            ...updatedState[startColIndex],
            stubStudies: updatedStartColStubStudiesList,
        };

        const updatedEndColStubStudiesList = [...updatedState[endColIndex].stubStudies];
        updatedEndColStubStudiesList.splice(destination.index, 0, draggable);
        const updatedEndCol = {
            ...updatedState[endColIndex],
            stubStudies: updatedEndColStubStudiesList,
        };

        updatedState[startColIndex] = updatedStartCol;
        updatedState[endColIndex] = updatedEndCol;
    }

    return updatedState;
};

export const initCurationHelper = (cols: string[], isPrisma: boolean): ICurationMetadata => {
    const columns: ICurationColumn[] = cols.map((col, index) => ({
        id: uuidv4(),
        name: col,
        stubStudies: [],
    }));

    const curation: ICurationMetadata = {
        columns: columns,
        prismaConfig: {
            isPrisma: isPrisma,
            identification: { exclusionTags: [] },
            screening: { exclusionTags: [] },
            eligibility: { exclusionTags: [] },
        },
        exclusionTags: Object.entries(defaultExclusionTags).map(([key, value]) => ({
            ...value,
        })),
        infoTags: Object.entries(defaultInfoTags).map(([key, value]) => ({ ...value })),
        identificationSources: Object.entries(defaultIdentificationSources).map(([key, value]) => ({
            ...value,
        })),
    };

    if (isPrisma) {
        curation.prismaConfig.identification.exclusionTags = [defaultExclusionTags.duplicate];
        curation.prismaConfig.screening.exclusionTags = [
            {
                id: ENeurosynthTagIds.IRRELEVANT_EXCLUSION_ID,
                label: 'Irrelevant',
                isExclusionTag: true,
                isAssignable: true,
            },
        ];
        curation.prismaConfig.eligibility.exclusionTags = [
            {
                id: ENeurosynthTagIds.REPORTS_NOT_RETRIEVED_EXCLUSION_ID,
                label: 'Reports not retrieved',
                isExclusionTag: true,
                isAssignable: true,
            },
            {
                id: ENeurosynthTagIds.INSUFFICIENT_DETAIL_EXCLUSION_ID,
                label: 'Insufficient Details',
                isExclusionTag: true,
                isAssignable: true,
            },
            {
                id: ENeurosynthTagIds.LIMITED_RIGOR_EXCLUSION_ID,
                label: 'Limited Rigor',
                isExclusionTag: true,
                isAssignable: true,
            },
            {
                id: ENeurosynthTagIds.OUT_OF_SCOPE_EXCLUSION_ID,
                label: 'Out of scope',
                isExclusionTag: true,
                isAssignable: true,
            },
        ];
    }
    return curation;
};

export const addNewStubsHelper = (
    state: ICurationColumn[],
    newStubs: ICurationStubStudy[]
): ICurationColumn[] => {
    const updatedState = [...state];
    updatedState[0] = {
        ...updatedState[0],
        stubStudies: [...newStubs, ...updatedState[0].stubStudies],
    };
    return updatedState;
};

export const deleteStubHelper = (
    state: ICurationColumn[],
    columnIndex: number,
    stubId: string
): ICurationColumn[] => {
    const updatedState = [...state];

    updatedState[columnIndex] = {
        ...updatedState[columnIndex],
        stubStudies: [...updatedState[columnIndex].stubStudies.filter((x) => x.id !== stubId)],
    };

    return updatedState;
};

export const updateStubFieldHelper = (
    state: ICurationColumn[],
    columnIndex: number,
    stubId: string,
    field: keyof ICurationStubStudy,
    updatedValue: string | number | ISource
): ICurationColumn[] => {
    const updatedState = [...state];
    const updatedStubsForColumn = [...updatedState[columnIndex].stubStudies];

    const stubIndex = updatedStubsForColumn.findIndex((stub) => stub.id === stubId);
    if (stubIndex < 0) return state;

    updatedStubsForColumn[stubIndex] = {
        ...updatedStubsForColumn[stubIndex],
        [field]: updatedValue,
    };

    updatedState[columnIndex] = {
        ...updatedState[columnIndex],
        stubStudies: updatedStubsForColumn,
    };

    return updatedState;
};

export const promoteStubHelper = (
    state: ICurationColumn[],
    columnIndex: number,
    stubId: string
): ICurationColumn[] => {
    const nextColumnExists = state[columnIndex + 1];
    const stubSourceIndex = state[columnIndex].stubStudies.findIndex((stub) => stub.id === stubId);

    if (nextColumnExists && stubSourceIndex >= 0) {
        const updatedState = [...state];

        const startColIndex = columnIndex;
        const endColIndex = columnIndex + 1;

        const updatedStartColStubStudiesList = [...updatedState[startColIndex].stubStudies];
        const promotedStub = { ...updatedStartColStubStudiesList[stubSourceIndex] };
        updatedStartColStubStudiesList.splice(stubSourceIndex, 1);
        updatedState[startColIndex] = {
            ...updatedState[startColIndex],
            stubStudies: updatedStartColStubStudiesList,
        };

        const updatedEndColStubStudiesList = [...updatedState[endColIndex].stubStudies];
        updatedEndColStubStudiesList.splice(0, 0, promotedStub);
        updatedState[endColIndex] = {
            ...updatedState[endColIndex],
            stubStudies: updatedEndColStubStudiesList,
        };

        return updatedState;
    }

    return state;
};

export const addTagToStubHelper = (
    state: ICurationColumn[],
    columnIndex: number,
    stubId: string,
    newTag: ITag
): ICurationColumn[] => {
    const updatedState = [...state];

    const updatedStubsForColumn = [...updatedState[columnIndex].stubStudies];
    const stubToUpdateIndex = updatedStubsForColumn.findIndex((stub) => stub.id === stubId);
    if (stubToUpdateIndex < 0) return state;

    const tagAlreadyExists = !!updatedState[columnIndex].stubStudies[stubToUpdateIndex].tags.find(
        (tag) => tag.id === newTag.id
    );
    if (tagAlreadyExists) return state;

    updatedStubsForColumn[stubToUpdateIndex] = {
        ...updatedStubsForColumn[stubToUpdateIndex],
        tags: [...updatedStubsForColumn[stubToUpdateIndex].tags, { ...newTag }],
    };

    updatedState[columnIndex] = {
        ...updatedState[columnIndex],
        stubStudies: updatedStubsForColumn,
    };

    return updatedState;
};

export const createNewExclusionHelper = (
    state: ICurationMetadata,
    newExclusion: ITag,
    phase: keyof Omit<IPRISMAConfig, 'isPrisma'> | undefined
): ICurationMetadata => {
    const updatedState = { ...state };

    if (!phase) {
        updatedState.exclusionTags = [...updatedState.exclusionTags, { ...newExclusion }];
    } else {
        updatedState.prismaConfig = {
            ...updatedState.prismaConfig,
            [phase]: {
                ...updatedState.prismaConfig[phase],
                exclusionTags: [
                    ...updatedState.prismaConfig[phase].exclusionTags,
                    { ...newExclusion },
                ],
            },
        };
    }

    return updatedState;
};

export const setExclusionForStubHelper = (
    state: ICurationColumn[],
    columnIndex: number,
    stubId: string,
    exclusion: ITag | null
): ICurationColumn[] => {
    const updatedState = [...state];

    const updatedStubsForColumn = [...updatedState[columnIndex].stubStudies];
    const stubToUpdateIndex = updatedStubsForColumn.findIndex((stub) => stub.id === stubId);
    if (stubToUpdateIndex < 0) return state;

    updatedStubsForColumn[stubToUpdateIndex] = {
        ...updatedStubsForColumn[stubToUpdateIndex],
        exclusionTag: exclusion,
    };

    updatedState[columnIndex] = {
        ...updatedState[columnIndex],
        stubStudies: updatedStubsForColumn,
    };

    return updatedState;
};

export const removeTagFromStubHelper = (
    state: ICurationColumn[],
    columnIndex: number,
    stubId: string,
    tagId: string
): ICurationColumn[] => {
    const updatedState = [...state];

    const updatedStubsForColumn = [...updatedState[columnIndex].stubStudies];
    const stubToUpdateIndex = updatedStubsForColumn.findIndex((stub) => stub.id === stubId);
    if (stubToUpdateIndex < 0) return state;

    updatedStubsForColumn[stubToUpdateIndex] = {
        ...updatedStubsForColumn[stubToUpdateIndex],
        tags: [...updatedStubsForColumn[stubToUpdateIndex].tags.filter((tag) => tag.id !== tagId)],
    };
    updatedState[columnIndex] = {
        ...updatedState[columnIndex],
        stubStudies: updatedStubsForColumn,
    };
    return updatedState;
};

export const addOrUpdateStudyListStatusHelper = (
    state: IStudyExtractionStatus[],
    id: string,
    newStatus: 'COMPLETE' | 'SAVEFORLATER'
): IStudyExtractionStatus[] => {
    const updatedState = [...state];

    const foundStudyStatusIndex = updatedState.findIndex((x) => x.id === id);
    if (foundStudyStatusIndex < 0) {
        updatedState.unshift({
            id: id,
            status: newStatus,
        });
    } else {
        updatedState[foundStudyStatusIndex] = {
            ...updatedState[foundStudyStatusIndex],
            status: newStatus,
        };
    }

    return updatedState;
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

            // project store calls set on init so we need to check that a project ID exists
            if (!storeData.id) return;

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
