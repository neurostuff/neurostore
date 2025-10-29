import { Box, Button, TextField, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { getURLFromSearchCriteria } from 'components/Search/search.helpers';
import { IImport } from 'hooks/projects/useGetProjects';
import { useSnackbar } from 'notistack';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { SELECTED_CURATION_STEP_LOCAL_STORAGE_KEY_SUFFIX } from 'pages/Curation/hooks/useCurationBoardGroupsState';
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
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import CurationImportFinalizeReview from './CurationImportFinalizeReview';
import CurationImportBaseStyles from './CurationImport.styles';

const generateDefaultImportName = (
    importMode: EImportMode,
    stubs: ICurationStubStudy[],
    searchCriteria: SearchCriteria | undefined,
    fileName: string | undefined
) => {
    switch (importMode) {
        case EImportMode.NEUROSTORE_IMPORT: {
            let finalImportName = '';

            if (searchCriteria?.genericSearchStr) {
                finalImportName = `${searchCriteria.genericSearchStr}`;
            }

            if (searchCriteria?.nameSearch) {
                const nameStrSegment = searchCriteria.nameSearch;
                finalImportName =
                    finalImportName.length > 0
                        ? `${finalImportName} with name "${nameStrSegment}"`
                        : `name "${nameStrSegment}"`;
            }

            if (searchCriteria?.journalSearch) {
                const journalStrSegment = searchCriteria.journalSearch;
                finalImportName =
                    finalImportName.length > 0
                        ? `${finalImportName} in journal "${journalStrSegment}"`
                        : `journal "${journalStrSegment}"`;
            }

            if (searchCriteria?.authorSearch) {
                const authorStrSegment = searchCriteria.authorSearch;
                finalImportName =
                    finalImportName.length > 0
                        ? `${finalImportName} by author "${authorStrSegment}"`
                        : `author "${authorStrSegment}"`;
            }

            if (searchCriteria?.descriptionSearch) {
                const descriptionStrSegment = searchCriteria.descriptionSearch;
                finalImportName =
                    finalImportName.length > 0
                        ? `${finalImportName} with description "${descriptionStrSegment}"`
                        : `description "${descriptionStrSegment}"`;
            }

            return finalImportName;
        }
        case EImportMode.FILE_IMPORT: {
            const source = stubs[0].identificationSource; // this is safe because we know we must have at least one stub
            const finalImportName = fileName ? `${fileName} from ${source.label}` : source.label;
            return finalImportName;
        }
        case EImportMode.SLEUTH_IMPORT: {
            return fileName ?? 'Sleuth Import';
        }
        case EImportMode.MANUAL_CREATE:
            return stubs[0].title || '';
        case EImportMode.PUBMED_IMPORT:
            if (fileName) {
                return `${fileName}`;
            } else {
                const pmids = stubs.reduce((acc, curr, index) => {
                    if (index === 0) return curr.pmid;
                    return `${acc}, ${curr.pmid}`;
                }, '');

                return pmids;
            }
    }
};

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

    const [importName, setImportName] = useState(
        generateDefaultImportName(importMode, stubs, searchCriteria, fileName)
    );

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

    const handleClickNext = () => {
        if (!importName) return;
        onFinalizeImport(importName);
        return;
    };

    return (
        <Box sx={{ paddingTop: '0.5rem' }}>
            <Box sx={{ margin: '1rem 0' }}>
                <Typography
                    gutterBottom
                    sx={{ fontWeight: 'bold', marginRight: '4px', display: 'inline' }}
                    variant="h6"
                >
                    Give your import a name:
                </Typography>
                <TextField
                    sx={{ width: '100%', marginTop: '0.5rem' }}
                    size="small"
                    value={importName}
                    onChange={(val) => setImportName(val.target.value)}
                />

                <CurationImportFinalizeReview stubs={stubs} unimportedStubs={unimportedStubs} />
            </Box>
            <Box sx={CurationImportBaseStyles.fixedContainer}>
                <Box sx={CurationImportBaseStyles.fixedButtonsContainer}>
                    <Button variant="outlined" onClick={() => onNavigate(ENavigationButton.PREV)}>
                        back
                    </Button>
                    <Button
                        variant="contained"
                        sx={CurationImportBaseStyles.nextButton}
                        disableElevation
                        disabled={!importName || stubs.length === 0}
                        onClick={handleClickNext}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default CurationImportFinalize;
