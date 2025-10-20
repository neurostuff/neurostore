import { Box } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import CurationImportCreateStub from 'pages/CurationImport/components/CurationImportCreateStub';
import CurationImportNeurostore from 'pages/CurationImport/components/CurationImportNeurostore';
import CurationImportPMIDs from 'pages/CurationImport/components/CurationImportPMIDs';
import CurationImportStandardFormat from './CurationImportStandardFormat';
import { SearchCriteria } from 'pages/Study/Study.types';
import CurationImportSleuth from './CurationImportSleuth';

export interface IImportArgs {
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
}

const CurationImportDoImport: React.FC<
    IImportArgs & {
        mode: EImportMode;
        onSetSearchCriteria: (searchCriteria: SearchCriteria) => void;
        onFileUpload: (fileName: string) => void;
    }
> = ({ mode, onImportStubs, onNavigate, onSetSearchCriteria, onFileUpload }) => {
    switch (mode) {
        case EImportMode.NEUROSTORE_IMPORT:
            return (
                <Box sx={{ marginTop: '1rem' }}>
                    <CurationImportNeurostore
                        onImportStubs={onImportStubs}
                        onSetSearchCriteria={onSetSearchCriteria}
                        onNavigate={onNavigate}
                    />
                </Box>
            );
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
