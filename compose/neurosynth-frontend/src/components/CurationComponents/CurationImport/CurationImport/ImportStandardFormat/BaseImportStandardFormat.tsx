import { Box } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { useState } from 'react';
import { hasDuplicates } from '../../helpers/utils';
import { IImportArgs } from '../CurationImport';
import ResolveImportDuplicates from '../ResolveImportDuplicates/ResolveImportDuplicates';
import ImportStandardFormat from './ImportStandardFormat';

const BaseImportStandardFormat: React.FC<IImportArgs> = (props) => {
    const [resolveDuplicates, setResolveDuplicates] = useState(false);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);

    const onImportStubs = (stubs: ICurationStubStudy[]) => {
        const duplicatesExist = hasDuplicates(stubs);
        if (duplicatesExist) {
            setStubs(stubs);
            setResolveDuplicates(true);
        } else {
            props.onImportStubs(stubs);
        }
    };

    const onResolveStubs = (updatedStubs: ICurationStubStudy[]) => {
        props.onImportStubs(updatedStubs);
    };

    return (
        <Box>
            {resolveDuplicates ? (
                <ResolveImportDuplicates
                    onNavigate={() => setResolveDuplicates(false)}
                    onResolveStubs={onResolveStubs}
                    stubs={stubs}
                />
            ) : (
                <ImportStandardFormat onNavigate={props.onNavigate} onImportStubs={onImportStubs} />
            )}
        </Box>
    );
};

export default BaseImportStandardFormat;
