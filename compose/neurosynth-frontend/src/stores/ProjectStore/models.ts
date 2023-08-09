import { LogoutOptions } from '@auth0/auth0-react';
import { DropResult, ResponderProvided } from '@hello-pangea/dnd';
import { AxiosError, AxiosResponse } from 'axios';
import {
    ICurationColumn,
    ICurationStubStudy,
    IImport,
    IPRISMAConfig,
    ISource,
    ITag,
} from 'interfaces/project/curation.interface';
import { IExtractionMetadata } from 'interfaces/project/extraction.interface';
import { INeurosynthProject, INeurosynthProjectReturn } from 'interfaces/project/project.interface';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { OptionsObject, SnackbarKey, SnackbarMessage } from 'notistack';
import { UseMutateFunction } from 'react-query';

export enum ENeurosynthSourceIds {
    NEUROSTORE = 'neurosynth_neurostore_id_source',
    PUBMED = 'neurosynth_pubmed_id_source',
    SCOPUS = 'neurosynth_scopus_id_source',
    WEBOFSCIENCE = 'neurosynth_web_of_science_id_source',
    PSYCINFO = 'neurosynth_psycinfo_id_source',
}

export enum ENeurosynthTagIds {
    UNTAGGED_TAG_ID = 'neurosynth_untagged_tag', // default info tag
    NEEDS_REVIEW_TAG_ID = 'neurosynth_needs_review_tag', // default info tag
    UNCATEGORIZED_ID = 'neurosynth_uncategorized_tag', // default info tag

    DUPLICATE_EXCLUSION_ID = 'neurosynth_duplicate_exclusion', // default exclusion
    IRRELEVANT_EXCLUSION_ID = 'neurosynth_irrelevant_exclusion', // default exclusion
    REPORTS_NOT_RETRIEVED_EXCLUSION_ID = 'neurosynth_reports_not_retrieved_exclusion', // default exclusion
    EXCLUDE_EXCLUSION_ID = 'neurosynth_exclude_exclusion', // default exclusion
    OUT_OF_SCOPE_EXCLUSION_ID = 'neurosynth_out_of_scope_exclusion', // default exclusion
    INSUFFICIENT_DETAIL_EXCLUSION_ID = 'neurosynth_insufficient_detail_exclusion', // default exclusion
    LIMITED_RIGOR_EXCLUSION_ID = 'neurosynth_limited_rigor', // default exclusion
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
    needsReview: {
        id: ENeurosynthTagIds.NEEDS_REVIEW_TAG_ID,
        label: 'Needs Review',
        isExclusionTag: false,
        isAssignable: false,
    },
};

export type TProjectStoreMetadata = {
    shouldUpdate: boolean; // this flag is for the debouncer
    enqueueSnackbar:
        | undefined
        | ((message: SnackbarMessage, options?: OptionsObject | undefined) => SnackbarKey);
    logout: undefined | ((options?: LogoutOptions | undefined) => void);
    debounceTimeout: undefined | NodeJS.Timeout;
    prevUpdatedProjectId: undefined | string;
    getProjectIsLoading: boolean;
    updateProjectIsLoading: boolean;
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

export type TProjectStoreActions = {
    updateProjectInDBDebounced: () => void;
    updateProjectName: (name: string) => void;
    updateProjectDescription: (description: string) => void;
    initProjectStore: (project: INeurosynthProjectReturn | undefined) => void;
    updateProjectMetadata: (metadata: Partial<TProjectStoreMetadata>) => void;
    clearProjectStore: () => void;
    initCuration: (cols: string[], isPrisma: boolean) => void;
    handleDrag: (result: DropResult, provided: ResponderProvided) => void;
    createNewExclusion: (
        newExclusion: ITag,
        arg: keyof Omit<IPRISMAConfig, 'isPrisma'> | undefined
    ) => void;
    createImport: (anImport: IImport) => void;
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
    promoteAllUncategorized: () => void; // TODO: improve this
    updateExtractionMetadata: (metadata: Partial<IExtractionMetadata>) => void;
    addOrUpdateStudyListStatus: (id: string, status: 'COMPLETE' | 'SAVEFORLATER') => void;
    replaceStudyListStatusId: (idToFindAndReplace: string, replaceWithId: string) => void;
    setGivenStudyStatusesAsComplete: (studyIdList: string[]) => void;
    deleteStub: (columnIndex: number, stubId: string) => void;
    allowEditMetaAnalyses: () => void;
};

export type TProjectStore = INeurosynthProjectReturn &
    TProjectStoreActions & { metadata: TProjectStoreMetadata };
