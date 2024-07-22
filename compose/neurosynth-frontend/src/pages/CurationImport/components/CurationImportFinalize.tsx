import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import {
    useProjectCurationColumns,
    useProjectId,
    useUpdateCurationColumns,
} from 'pages/Project/store/ProjectStore';
import { useNavigate } from 'react-router-dom';
import { flattenColumns, createDuplicateMap } from 'pages/CurationImport/CurationImport.helpers';
import { EImportMode, IDuplicateCase } from 'pages/CurationImport/CurationImport.types';
import CurationImportFinalizeNameAndReview from './CurationImportFinalizeNameAndReview';
import CurationImportResolveDuplicatesProject from 'pages/CurationImport/components/CurationImportResolveDuplicatesProject';

const CurationImportFinalize: React.FC<{
    importMode: EImportMode;
    onNavigate: (button: ENavigationButton) => void;
    stubs: ICurationStubStudy[];
    unimportedStubs: string[];
    isResolvingDuplicates: boolean;
    onIsResolvingDuplicates: (update: boolean) => void;
}> = (props) => {
    const {
        onNavigate,
        stubs,
        unimportedStubs,
        isResolvingDuplicates,
        onIsResolvingDuplicates,
        importMode,
    } = props;

    const columns = useProjectCurationColumns();
    const updateCurationColumns = useUpdateCurationColumns();
    const navigate = useNavigate();
    const projectId = useProjectId();

    const hasDuplicates = (stubs: ICurationStubStudy[]) => {
        const allStubsInProject = flattenColumns(columns);
        const { duplicateMapping } = createDuplicateMap(allStubsInProject);

        return stubs.some((importedStub) => {
            if (importedStub.exclusionTag !== null) return false;
            const formattedTitle = importedStub.title.toLocaleLowerCase().trim();
            if (importedStub.doi && duplicateMapping.has(importedStub.doi)) return true;
            if (importedStub.pmid && duplicateMapping.has(importedStub.pmid)) return true;
            if (importedStub.title && duplicateMapping.has(formattedTitle)) return true;
            return false;
        });
    };

    const handleDoneNamingImport = (stubs: ICurationStubStudy[]) => {
        const duplicatesExist = hasDuplicates(stubs);
        if (duplicatesExist) {
            onIsResolvingDuplicates(true);
        } else {
            onIsResolvingDuplicates(false);
            onFinalizeImport(stubs, []);
        }
    };

    const onFinalizeImport = (stubs: ICurationStubStudy[], duplicates: IDuplicateCase[]) => {
        // handle import
        const updatedImport = [...stubs];
        const updatedColumns = [...columns];

        duplicates.forEach(({ importedStub, projectDuplicates }) => {
            // update the status of the stub being imported
            updatedImport[importedStub.index] = {
                ...updatedImport[importedStub.index],
                exclusionTag: importedStub.exclusionTag,
            };

            // update the status of all the duplicates in the project
            projectDuplicates.forEach((projectDuplicateStub) => {
                if (
                    projectDuplicateStub.columnIndex === undefined ||
                    projectDuplicateStub.studyIndex === undefined
                ) {
                    return;
                }

                const updatedStubStudies = [
                    ...updatedColumns[projectDuplicateStub.columnIndex].stubStudies,
                ];

                if (
                    projectDuplicateStub.columnIndex > 0 &&
                    projectDuplicateStub.resolution === 'duplicate'
                ) {
                    // remove stubs that have already been promoted that the user resolved as a duplicate
                    updatedStubStudies.splice(projectDuplicateStub.studyIndex);
                    const { columnIndex, studyIndex, resolution, colName, ...stub } =
                        projectDuplicateStub;

                    // add the stub back to the first column in order to demote it
                    updatedColumns[0] = {
                        ...updatedColumns[0],
                        stubStudies: [stub, ...updatedColumns[0].stubStudies],
                    };
                } else {
                    updatedStubStudies[projectDuplicateStub.studyIndex] = {
                        ...updatedStubStudies[projectDuplicateStub.studyIndex],
                        exclusionTag: projectDuplicateStub.exclusionTag,
                    };
                }

                updatedColumns[projectDuplicateStub.columnIndex] = {
                    ...updatedColumns[projectDuplicateStub.columnIndex],
                    stubStudies: updatedStubStudies,
                };
            });
        });

        updatedColumns[0] = {
            ...updatedColumns[0],
            stubStudies: [...updatedImport, ...updatedColumns[0].stubStudies],
        };
        updateCurationColumns(updatedColumns);
        navigate(`/projects/${projectId}/curation`);
    };

    if (isResolvingDuplicates) {
        return (
            <CurationImportResolveDuplicatesProject
                stubs={props.stubs}
                onNavigate={props.onNavigate}
                onFinalizeImport={onFinalizeImport}
            />
        );
    }

    return (
        <CurationImportFinalizeNameAndReview
            onNavigate={onNavigate}
            onUpdateStubs={handleDoneNamingImport}
            stubs={stubs}
            unimportedStubs={unimportedStubs}
            importMode={importMode}
        />
    );
};

export default CurationImportFinalize;
