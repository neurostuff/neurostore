import { Box } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { hasDuplicates } from '../../helpers/utils';
import { IImportArgs } from '../CurationDoImport';
import ResolveImportDuplicates from '../ResolveImportDuplicates/ResolveImportDuplicates';
import NeurostoreSearch from './NeurostoreSearch';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';

const BaseImportFromNeurostore: React.FC<IImportArgs> = (props) => {
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
            <ResolveImportDuplicates
                onImportStubs={handleResolveStubs}
                onNavigate={onNavigate}
                stubs={stubs}
            />
        );
    }

    return (
        <Box sx={{ marginTop: '1rem' }}>
            <NeurostoreSearch {...props} onImportStubs={handleOnImportStubs} />
        </Box>
    );
};

export default BaseImportFromNeurostore;
