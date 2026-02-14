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
import { QueryClient, UseMutateFunction } from 'react-query';

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
    queryClient: QueryClient | undefined;
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
    deleteCurationImport: (curationImportId: string) => void;
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
    setExclusionForStub: (columnIndex: number, stubId: string, exclusionId: string | null) => void;
    promoteStub: (columnIndex: number, stubId: string) => void;
    demoteStub: (columnIndex: number, stubId: string) => void;
    promoteAllUncategorized: () => void; // TODO: improve this
    updateExtractionMetadata: (metadata: Partial<IExtractionMetadata>) => void;
    addOrUpdateStudyListStatus: (id: string, status: EExtractionStatus) => void;
    removeStudyListStatus: (id: string) => void;
    replaceStudyListStatusId: (idToFindAndReplace: string, replaceWithId: string) => void;
    setGivenStudyStatusesAsComplete: (studyIdList: string[]) => void;
    allowEditMetaAnalyses: (allowEditMetaAnalysis: boolean) => void;
    updateExclusionTag: (id: string, newName: string) => void;
};

export type TProjectStore = INeurosynthProjectReturn & ProjectStoreActions & { metadata: ProjectStoreMetadata };
