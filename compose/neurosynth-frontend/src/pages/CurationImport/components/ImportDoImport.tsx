import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { EImportMode, ICurationStubStudy } from 'pages/Curation/Curation.types';
import ImportCreateStub from 'pages/CurationImport/components/ImportCreateStub';
import ImportPMIDs from 'pages/CurationImport/components/ImportPMIDs';
import ImportStandardFormat from './ImportStandardFormat';
import ImportSleuth from './ImportSleuth';

export interface IImportArgs {
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
}

const ImportDoImport: React.FC<
    IImportArgs & {
        mode: EImportMode;
        onFileUpload: (fileName: string) => void;
    }
> = ({ mode, onImportStubs, onNavigate, onFileUpload }) => {
    switch (mode) {
        case EImportMode.SLEUTH_IMPORT:
            return <ImportSleuth onImportStubs={onImportStubs} onNavigate={onNavigate} onFileUpload={onFileUpload} />;
        case EImportMode.PUBMED_IMPORT:
            return <ImportPMIDs onImportStubs={onImportStubs} onFileUpload={onFileUpload} onNavigate={onNavigate} />;
        case EImportMode.MANUAL_CREATE:
            return <ImportCreateStub onImportStubs={onImportStubs} onNavigate={onNavigate} />;
        default:
            return (
                <ImportStandardFormat
                    onNavigate={onNavigate}
                    onFileUpload={onFileUpload}
                    onImportStubs={onImportStubs}
                />
            );
    }
};

export default ImportDoImport;
