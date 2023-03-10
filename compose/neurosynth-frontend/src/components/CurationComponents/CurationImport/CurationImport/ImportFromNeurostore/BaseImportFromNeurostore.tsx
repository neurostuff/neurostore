import { Box } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { useState } from 'react';
import { hasDuplicates } from '../../helpers/utils';
import { IImportArgs } from '../CurationImport';
import ResolveImportDuplicates from '../ResolveImportDuplicates/ResolveImportDuplicates';
import NeurostoreSearch from './NeurostoreSearch';

const BaseImportFromNeurostore: React.FC<IImportArgs> = (props) => {
    const [resolveDuplicates, setResolveDuplicates] = useState(false);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);

    const handleOnImportStubs = (stubs: ICurationStubStudy[]) => {
        const duplicatesExist = hasDuplicates(stubs);
        if (duplicatesExist) {
            setStubs(stubs);
            setResolveDuplicates(true);
        } else {
            props.onImportStubs(stubs);
        }
    };

    const handleResolveStubs = (updatedStubs: ICurationStubStudy[]) => {
        props.onImportStubs(updatedStubs);
    };

    if (resolveDuplicates) {
        return (
            <ResolveImportDuplicates
                onResolveStubs={handleResolveStubs}
                onNavigate={props.onNavigate}
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
