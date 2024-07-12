import { Box } from '@mui/material';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { IImportArgs } from './CurationImportDoImport';
import CurationImportResolveDuplicatesImport from './CurationImportResolveDuplicatesImport';
import CurationImportNeurostoreSearch from './CurationImportNeurostoreSearch';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { hasDuplicates } from 'pages/CurationImport/CurationImport.helpers';

const CurationImportNeurostore: React.FC<IImportArgs> = (props) => {
    const { onNavigate, onImportStubs, onIsResolvingDuplicates, isResolvingDuplicates, stubs } =
        props;

    const handleOnImportStubs = (stubs: ICurationStubStudy[]) => {
        onImportStubs(stubs);
        const duplicatesExist = hasDuplicates(stubs);
        if (duplicatesExist) {
            onIsResolvingDuplicates(true);
        } else {
            onIsResolvingDuplicates(true);
            onNavigate(ENavigationButton.NEXT);
        }
    };

    const handleResolveStubs = (updatedStubs: ICurationStubStudy[]) => {
        onIsResolvingDuplicates(false);
        onImportStubs(updatedStubs);
    };

    if (isResolvingDuplicates) {
        return (
            <CurationImportResolveDuplicatesImport
                onImportStubs={handleResolveStubs}
                onNavigate={onNavigate}
                stubs={stubs}
            />
        );
    }

    return (
        <Box sx={{ marginTop: '1rem' }}>
            <CurationImportNeurostoreSearch {...props} onImportStubs={handleOnImportStubs} />
        </Box>
    );
};

export default CurationImportNeurostore;
