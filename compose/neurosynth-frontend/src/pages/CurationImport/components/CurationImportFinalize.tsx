import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { getURLFromSearchCriteria } from 'components/Search/search.helpers';
import { IImport } from 'hooks/projects/useGetProjects';
import { useSnackbar } from 'notistack';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import {
    automaticallyResolveDuplicates,
    createDuplicateMap,
    hasDuplicates,
} from 'pages/CurationImport/CurationImport.helpers';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import {
    useCreateNewCurationImport,
    useProjectCurationColumns,
    useProjectId,
    useUpdateCurationColumns,
} from 'pages/Project/store/ProjectStore';
import { defaultExclusionTags } from 'pages/Project/store/ProjectStore.types';
import { SearchCriteria } from 'pages/Study/Study.types';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import CurationImportFinalizeNameAndReview from './CurationImportFinalizeNameAndReview';
import { SELECTED_CURATION_STEP_LOCAL_STORAGE_KEY_SUFFIX } from 'pages/Curation/hooks/useCurationBoardGroupsState';

const CurationImportFinalize: React.FC<{
    importMode: EImportMode;
    onNavigate: (button: ENavigationButton) => void;
    stubs: ICurationStubStudy[];
    unimportedStubs: string[];
    searchCriteria: SearchCriteria | undefined;
    fileName: string | undefined;
}> = ({ onNavigate, stubs, unimportedStubs, importMode, searchCriteria, fileName }) => {
    const { enqueueSnackbar } = useSnackbar();
    const updateCurationColumns = useUpdateCurationColumns();
    const columns = useProjectCurationColumns();
    const createNewImport = useCreateNewCurationImport();
    const navigate = useNavigate();
    const projectId = useProjectId();

    const onFinalizeImport = (importName: string) => {
        // 1. create new import. Add import to all stubs.
        const newImport: IImport = {
            id: uuid(),
            name: importName,
            errorsDuringImport:
                unimportedStubs.length > 0
                    ? `Unable to import studies with the following IDs: ${unimportedStubs.join(', ')}`
                    : undefined,
            importModeUsed: importMode,
            numImported: stubs.length,
            date: new Date().toISOString(),
            neurostoreSearchParams: searchCriteria ? getURLFromSearchCriteria(searchCriteria) : undefined,
        };
        createNewImport(newImport);
        stubs.forEach((stub) => {
            stub.importId = newImport.id;
        });

        // // 2. first find duplicates ONLY WITHIN THE IMPORT ITSELF. Label as duplicate.
        const duplicatesExistWithinImport = hasDuplicates(stubs);
        const deduplicatedStubs = duplicatesExistWithinImport ? automaticallyResolveDuplicates(stubs) : stubs;

        // // 3. Label the stubs in the import as duplicates automatically if we find existing stubs IN THE PROJECT
        const allStubsInProject = columns.reduce(
            (acc, curr) => [...acc, ...curr.stubStudies],
            [] as ICurationStubStudy[]
        );
        const { duplicateMapping } = createDuplicateMap(allStubsInProject);
        deduplicatedStubs.forEach((importedStub) => {
            if (importedStub.exclusionTag !== null) return;
            const formattedTitle = importedStub.title.toLocaleLowerCase().trim();
            if (importedStub.doi && duplicateMapping.has(importedStub.doi)) {
                importedStub.exclusionTag = defaultExclusionTags.duplicate;
            } else if (importedStub.pmid && duplicateMapping.has(importedStub.pmid)) {
                importedStub.exclusionTag = defaultExclusionTags.duplicate;
            } else if (importedStub.title && duplicateMapping.has(formattedTitle)) {
                importedStub.exclusionTag = defaultExclusionTags.duplicate;
            }
        });

        const updatedColumns = [...columns];
        updatedColumns[0] = {
            ...updatedColumns[0],
            stubStudies: [...deduplicatedStubs, ...updatedColumns[0].stubStudies],
        };

        updateCurationColumns(updatedColumns);
        enqueueSnackbar(`Added new import: ${importName}`, { variant: 'success' });
        localStorage.removeItem(`${projectId}${SELECTED_CURATION_STEP_LOCAL_STORAGE_KEY_SUFFIX}`);
        navigate(`/projects/${projectId}/curation`);
    };

    return (
        <CurationImportFinalizeNameAndReview
            onNavigate={onNavigate}
            onNameImport={onFinalizeImport}
            stubs={stubs}
            fileName={fileName}
            searchCriteria={searchCriteria}
            unimportedStubs={unimportedStubs}
            importMode={importMode}
        />
    );
};

export default CurationImportFinalize;
