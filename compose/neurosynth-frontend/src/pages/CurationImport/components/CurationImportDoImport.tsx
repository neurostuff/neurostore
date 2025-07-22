import { Box } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import CurationImportCreateStub from 'pages/CurationImport/components/CurationImportCreateStub';
import CurationImportNeurostore from 'pages/CurationImport/components/CurationImportNeurostore';
import CurationImportPMIDs from 'pages/CurationImport/components/CurationImportPMIDs';
import CurationImportStandardFormat from './CurationImportStandardFormat';
import { SearchCriteria } from 'pages/Study/Study.types';

export interface IImportArgs {
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
    stubs: ICurationStubStudy[];
}

const CurationImportDoImport: React.FC<
    IImportArgs & {
        mode: EImportMode;
        onSetSearchCriteria: (searchCriteria: SearchCriteria) => void;
        onFileUpload: (fileName: string) => void;
    }
> = ({ mode, stubs, onImportStubs, onNavigate, onSetSearchCriteria, onFileUpload }) => {
    switch (mode) {
        case EImportMode.NEUROSTORE_IMPORT:
            return (
                <Box sx={{ marginTop: '1rem' }}>
                    <CurationImportNeurostore
                        stubs={stubs}
                        onImportStubs={onImportStubs}
                        onSetSearchCriteria={onSetSearchCriteria}
                        onNavigate={onNavigate}
                    />
                </Box>
            );
        case EImportMode.PUBMED_IMPORT:
            return (
                <CurationImportPMIDs
                    stubs={stubs}
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
