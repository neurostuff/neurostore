import { LogoutOptions } from '@auth0/auth0-react';
import { DropResult, ResponderProvided } from '@hello-pangea/dnd';
import { AxiosResponse, AxiosError } from 'axios';
import {
    INeurosynthProject,
    INeurosynthProjectReturn,
    ITag,
    IPRISMAConfig,
    ISource,
    IExtractionMetadata,
    IImport,
} from 'hooks/projects/useGetProjects';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { SnackbarMessage, OptionsObject, SnackbarKey } from 'notistack';
import { ICurationColumn, ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import { UseMutateFunction } from 'react-query';

export enum ENeurosynthSourceIds {
    NEUROSTORE = 'neurosynth_neurostore_id_source',
    PUBMED = 'neurosynth_pubmed_id_source',
    SCOPUS = 'neurosynth_scopus_id_source',
    WEBOFSCIENCE = 'neurosynth_web_of_science_id_source',
    PSYCINFO = 'neurosynth_psycinfo_id_source',
    SLEUTH = 'neurosynth_sleuth_id_source',
}

export enum ENeurosynthTagIds {
    UNTAGGED_TAG_ID = 'neurosynth_untagged_tag', // default info tag
    NEEDS_REVIEW_TAG_ID = 'neurosynth_needs_review_tag', // default info tag
    UNCATEGORIZED_ID = 'neurosynth_uncategorized_tag', // default info tag

    DUPLICATE_EXCLUSION_ID = 'neurosynth_duplicate_exclusion', // default exclusion (prisma)
    IRRELEVANT_EXCLUSION_ID = 'neurosynth_irrelevant_exclusion', // default exclusion (prisma)
    REPORTS_NOT_RETRIEVED_EXCLUSION_ID = 'neurosynth_reports_not_retrieved_exclusion', // default exclusion (prisma)
    OUT_OF_SCOPE_EXCLUSION_ID = 'neurosynth_out_of_scope_exclusion', // default exclusion (prisma)
    INSUFFICIENT_DETAIL_EXCLUSION_ID = 'neurosynth_insufficient_detail_exclusion', // default exclusion (prisma)
    LIMITED_RIGOR_EXCLUSION_ID = 'neurosynth_limited_rigor', // default exclusion (prisma)
    EXCLUDE_EXCLUSION_ID = 'neurosynth_exclude_exclusion', // default exclusion
}

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
    sleuth: {
        id: ENeurosynthSourceIds.SLEUTH,
        label: 'Sleuth',
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

export type ProjectStoreMetadata = {
    enqueueSnackbar: undefined | ((message: SnackbarMessage, options?: OptionsObject | undefined) => SnackbarKey);
    logout: undefined | ((options?: LogoutOptions | undefined) => void);
    debounceTimeout: undefined | NodeJS.Timeout;
    prevUpdatedProjectId: undefined | string;
    getProjectIsLoading: boolean;
    updateProjectIsLoading: boolean;
    hasUnsavedChanges: boolean;
    isError: boolean;
    error: string | undefined;
    updateProject:
        | UseMutateFunction<
              AxiosResponse<ProjectReturn>,
              AxiosError<any>,
              { projectId: string; project: INeurosynthProject },
              unknown
          >
        | undefined;
};

export type ProjectStoreActions = {
    updateProjectInDBDebounced: () => void;
    updateProjectName: (name: string) => void;
    updateProjectIsPublic: (isPublic: boolean) => void;
    updateProjectDescription: (description: string) => void;
    initProjectStore: (project: INeurosynthProjectReturn | undefined) => void;
    updateProjectMetaAnalyses: (meta_analyses: string[]) => void;
    updateProjectMetadata: (metadata: Partial<ProjectStoreMetadata>) => void;
    clearProjectStore: () => void;
    initCuration: (cols: string[], isPrisma: boolean) => void;
    handleDrag: (result: DropResult, provided: ResponderProvided) => void;
    createNewExclusion: (newExclusion: ITag, arg: keyof Omit<IPRISMAConfig, 'isPrisma'> | undefined) => void;
    createNewInfoTag: (newTag: ITag) => void;
    createNewIdentificationSource: (newSource: ISource) => void;
    createNewCurationImport: (newImport: IImport) => void;
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
    demoteStub: (columnIndex: number, stubId: string) => void;
    promoteAllUncategorized: () => void; // TODO: improve this
    updateExtractionMetadata: (metadata: Partial<IExtractionMetadata>) => void;
    addOrUpdateStudyListStatus: (id: string, status: EExtractionStatus) => void;
    replaceStudyListStatusId: (idToFindAndReplace: string, replaceWithId: string) => void;
    setGivenStudyStatusesAsComplete: (studyIdList: string[]) => void;
    deleteStub: (columnIndex: number, stubId: string) => void;
    allowEditMetaAnalyses: (allowEditMetaAnalysis: boolean) => void;
};

export type TProjectStore = INeurosynthProjectReturn & ProjectStoreActions & { metadata: ProjectStoreMetadata };
