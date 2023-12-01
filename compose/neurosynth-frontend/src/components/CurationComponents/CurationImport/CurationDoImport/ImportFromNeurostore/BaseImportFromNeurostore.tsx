import { Box } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { useState } from 'react';
import { hasDuplicates } from '../../helpers/utils';
import { IImportArgs } from '../CurationDoImport';
import ResolveImportDuplicates from '../ResolveImportDuplicates/ResolveImportDuplicates';
import NeurostoreSearch from './NeurostoreSearch';

const BaseImportFromNeurostore: React.FC<IImportArgs> = (props) => {
    const { onNavigate, onImportStubs, onIsResolvingDuplicates, isResolvingDuplicates } = props;
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);

    const handleOnImportStubs = (stubs: ICurationStubStudy[]) => {
        const duplicatesExist = hasDuplicates(stubs);
        if (duplicatesExist) {
            setStubs(stubs);
            onIsResolvingDuplicates(true);
        } else {
            onIsResolvingDuplicates(false);
            onImportStubs(stubs);
        }
    };

    const handleResolveStubs = (updatedStubs: ICurationStubStudy[]) => {
        onIsResolvingDuplicates(false);
        onImportStubs(updatedStubs);
    };

    if (isResolvingDuplicates) {
        return (
            <ResolveImportDuplicates
                onResolveStubs={handleResolveStubs}
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
