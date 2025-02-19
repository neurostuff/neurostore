import { Box } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import CurationImportCreateStub from 'pages/CurationImport/components/CurationImportCreateStub';
import CurationImportNeurostore from 'pages/CurationImport/components/CurationImportNeurostore';
import CurationImportPMIDs from 'pages/CurationImport/components/CurationImportPMIDs';
import CurationImportStandardFormat from './CurationImportStandardFormat';

export interface IImportArgs {
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
    stubs: ICurationStubStudy[];
}

const CurationImportDoImport: React.FC<IImportArgs & { mode: EImportMode }> = ({
    mode,
    stubs,
    onImportStubs,
    onNavigate,
}) => {
    switch (mode) {
        case EImportMode.NEUROSTORE_IMPORT:
            return (
                <Box sx={{ marginTop: '1rem' }}>
                    <CurationImportNeurostore stubs={stubs} onImportStubs={onImportStubs} onNavigate={onNavigate} />
                </Box>
            );
        case EImportMode.PUBMED_IMPORT:
            return <CurationImportPMIDs stubs={stubs} onImportStubs={onImportStubs} onNavigate={onNavigate} />;
        case EImportMode.MANUAL_CREATE:
            return <CurationImportCreateStub onImportStubs={onImportStubs} onNavigate={onNavigate} />;
        default:
            return <CurationImportStandardFormat onNavigate={onNavigate} onImportStubs={onImportStubs} />;
    }
};

export default CurationImportDoImport;
