import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/Curation/Curation.types';
import CurationImportCreateStub from 'pages/CurationImport/components/CurationImportCreateStub';
import CurationImportPMIDs from 'pages/CurationImport/components/CurationImportPMIDs';
import CurationImportStandardFormat from './CurationImportStandardFormat';
import CurationImportSleuth from './CurationImportSleuth';

export interface IImportArgs {
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
}

const CurationImportDoImport: React.FC<
    IImportArgs & {
        mode: EImportMode;
        onFileUpload: (fileName: string) => void;
    }
> = ({ mode, onImportStubs, onNavigate, onFileUpload }) => {
    switch (mode) {
        case EImportMode.SLEUTH_IMPORT:
            return (
                <CurationImportSleuth
                    onImportStubs={onImportStubs}
                    onNavigate={onNavigate}
                    onFileUpload={onFileUpload}
                />
            );
        case EImportMode.PUBMED_IMPORT:
            return (
                <CurationImportPMIDs
                    onImportStubs={onImportStubs}
                    onFileUpload={onFileUpload}
                    onNavigate={onNavigate}
                />
            );
        case EImportMode.MANUAL_CREATE:
            return <CurationImportCreateStub onImportStubs={onImportStubs} onNavigate={onNavigate} />;
        default:
            return (
                <CurationImportStandardFormat
                    onNavigate={onNavigate}
                    onFileUpload={onFileUpload}
                    onImportStubs={onImportStubs}
                />
            );
    }
};

export default CurationImportDoImport;
