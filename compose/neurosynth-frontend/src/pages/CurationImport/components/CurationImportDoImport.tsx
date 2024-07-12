import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import CurationImportNeurostore from 'pages/CurationImport/components/CurationImportNeurostore';
import CurationImportPMIDs from 'pages/CurationImport/components/CurationImportPMIDs';
import CurationImportCreateStub from 'pages/CurationImport/components/CurationImportCreateStub';
import CurationImportStandardFormat from './CurationImportStandardFormat';

export interface IImportArgs {
    onNavigate: (button: ENavigationButton) => void;
    onIsResolvingDuplicates: (isResolvingDuplicates: boolean) => void;
    isResolvingDuplicates: boolean;
    onImportStubs: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
    stubs: ICurationStubStudy[];
}

const CurationImportDoImport: React.FC<{
    mode: EImportMode;
    isResolvingDuplicates: boolean;
    onIsResolvingDuplicates: (isResolvingDuplicates: boolean) => void;
    onImportStubs: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
    onNavigate: (button: ENavigationButton) => void;
    stubs: ICurationStubStudy[];
}> = (props) => {
    if (props.mode === EImportMode.NEUROSTORE_IMPORT) {
        return (
            <CurationImportNeurostore
                stubs={props.stubs}
                onIsResolvingDuplicates={props.onIsResolvingDuplicates}
                isResolvingDuplicates={props.isResolvingDuplicates}
                onImportStubs={props.onImportStubs}
                onNavigate={props.onNavigate}
            />
        );
    } else if (props.mode === EImportMode.PUBMED_IMPORT) {
        return (
            <CurationImportPMIDs
                stubs={props.stubs}
                onIsResolvingDuplicates={props.onIsResolvingDuplicates}
                isResolvingDuplicates={props.isResolvingDuplicates}
                onImportStubs={props.onImportStubs}
                onNavigate={props.onNavigate}
            />
        );
    } else if (props.mode === EImportMode.MANUAL_CREATE) {
        return (
            <CurationImportCreateStub
                onImportStubs={props.onImportStubs}
                onNavigate={props.onNavigate}
            />
        );
    } else {
        return (
            <CurationImportStandardFormat
                stubs={props.stubs}
                onIsResolvingDuplicates={props.onIsResolvingDuplicates}
                isResolvingDuplicates={props.isResolvingDuplicates}
                onImportStubs={props.onImportStubs}
                onNavigate={props.onNavigate}
            />
        );
    }
};

export default CurationImportDoImport;
