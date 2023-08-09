import { useAuth0 } from '@auth0/auth0-react';
import { useUpdateProject, useGetProjectById } from 'hooks';
import { useSnackbar } from 'notistack';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useProjectStore from 'stores/ProjectStore/store';
import { useProjectId } from 'stores/ProjectStore/getters';

// curation updater hooks
export const useUpdateProjectName = () => useProjectStore((state) => state.updateProjectName);
export const useUpdateProjectDescription = () =>
    useProjectStore((state) => state.updateProjectDescription);
export const useInitProjectStore = () => useProjectStore((state) => state.initProjectStore);
export const useClearProjectStore = () => useProjectStore((state) => state.clearProjectStore);
export const useClearProvenance = () => useProjectStore((state) => state.clearProvenance);
export const useHandleCurationDrag = () => useProjectStore((state) => state.handleDrag);
export const useCreateNewCurationImport = () => useProjectStore((state) => state.createImport);
export const useUpdateCurationColumns = () =>
    useProjectStore((state) => state.updateCurationColumns);
export const useAddNewCurationStubs = () => useProjectStore((state) => state.addNewStubs);
export const useInitCuration = () => useProjectStore((state) => state.initCuration);
export const useUpdateStubField = () => useProjectStore((state) => state.updateStubField);
export const usePromoteStub = () => useProjectStore((state) => state.promoteStub);
export const usePromoteAllUncategorized = () =>
    useProjectStore((state) => state.promoteAllUncategorized);
export const useAddTagToStub = () => useProjectStore((state) => state.addTagToStub);
export const useRemoveTagFromStub = () => useProjectStore((state) => state.removeTagFromStub);
export const useSetExclusionFromStub = () => useProjectStore((state) => state.setExclusionForStub);
export const useCreateNewExclusion = () => useProjectStore((state) => state.createNewExclusion);
export const useDeleteStub = () => useProjectStore((state) => state.deleteStub);
export const useUpdateProjectMetadata = () =>
    useProjectStore((state) => state.updateProjectMetadata);
export const useInitProjectStoreIfRequired = () => {
    const clearProjectStore = useClearProjectStore();
    const initProjectStore = useInitProjectStore();
    const updateProjectMetadata = useUpdateProjectMetadata();
    const projectIdFromProject = useProjectId();

    const { enqueueSnackbar } = useSnackbar();
    const { logout } = useAuth0();
    const { projectId } = useParams<{ projectId: string; studyId: string }>();

    const {
        mutate,
        isLoading: useUpdateProjectIsLoading,
        isError: useUpdateProjectIsError,
    } = useUpdateProject();
    const {
        data,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);

    const isError = useUpdateProjectIsError || getProjectIsError;

    useEffect(() => {
        if (projectId && projectId !== projectIdFromProject) {
            clearProjectStore();
            initProjectStore(data);
            updateProjectMetadata({
                updateProject: mutate,
                logout: logout,
                enqueueSnackbar: enqueueSnackbar,
                shouldUpdate: true,
                getProjectIsLoading: getProjectIsLoading,
                updateProjectIsLoading: useUpdateProjectIsLoading,
                isError: isError,
            });
        } else {
            updateProjectMetadata({
                updateProject: mutate, // must pass in mutate func as it gets redefined when component unmounts
                getProjectIsLoading: getProjectIsLoading,
                updateProjectIsLoading: useUpdateProjectIsLoading,
                isError: isError,
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
    ]);
};

// extraction updater hooks
export const useUpdateExtractionMetadata = () =>
    useProjectStore((state) => state.updateExtractionMetadata);

// metaAnalysisAlgorithm updater hooks
export const useAllowEditMetaAnalyses = () =>
    useProjectStore((state) => state.allowEditMetaAnalyses);
