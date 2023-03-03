import { Box } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import CreateStubStudy from './CreateStubStudy/CreateStubStudy';
import BaseImportPMIDs from './ImportPMIDs/BaseImportPMIDs';
import ImportStandardFormat from './ImportStandardFormat/ImportStandardFormat';

export enum EImportMode {
    NEUROSTORE_IMPORT = 'NEUROSTORE_IMPORT',
    PUBMED_IMPORT = 'PUBMED_IMPORT',
    MANUAL_CREATE = 'MANUAL_CREATE',
    FILE_IMPORT = 'FILE_IMPORT',
}

const CurationImport: React.FC<{
    mode: EImportMode;
    onImportStubs: (stubs: ICurationStubStudy[]) => void;
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    if (props.mode === EImportMode.NEUROSTORE_IMPORT) {
        return <div>tbd</div>;
    } else if (props.mode === EImportMode.PUBMED_IMPORT) {
        return (
            <BaseImportPMIDs onImportStubs={props.onImportStubs} onNavigate={props.onNavigate} />
        );
    } else if (props.mode === EImportMode.MANUAL_CREATE) {
        return (
            <CreateStubStudy onImportStubs={props.onImportStubs} onNavigate={props.onNavigate} />
        );
    } else {
        return <ImportStandardFormat />;
    }
};

export default CurationImport;
