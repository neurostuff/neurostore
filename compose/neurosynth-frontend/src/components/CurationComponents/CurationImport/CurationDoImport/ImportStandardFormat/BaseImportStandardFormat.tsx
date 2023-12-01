import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { useState } from 'react';
import { hasDuplicates } from '../../helpers/utils';
import { IImportArgs } from '../CurationDoImport';
import ResolveImportDuplicates from '../ResolveImportDuplicates/ResolveImportDuplicates';
import ImportStandardFormat from './ImportStandardFormat';

const BaseImportStandardFormat: React.FC<IImportArgs> = (props) => {
    const { onNavigate, onImportStubs, onIsResolvingDuplicates, isResolvingDuplicates } = props;
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);

    const handleImportStubs = (stubs: ICurationStubStudy[]) => {
        const duplicatesExist = hasDuplicates(stubs);
        if (duplicatesExist) {
            setStubs(stubs);
            onIsResolvingDuplicates(true);
        } else {
            onImportStubs(stubs);
        }
    };

    const onResolveStubs = (updatedStubs: ICurationStubStudy[]) => {
        onImportStubs(updatedStubs);
    };

    if (isResolvingDuplicates) {
        return (
            <ResolveImportDuplicates
                onNavigate={() => onIsResolvingDuplicates(false)}
                onResolveStubs={onResolveStubs}
                stubs={stubs}
            />
        );
    }

    return <ImportStandardFormat onNavigate={onNavigate} onImportStubs={handleImportStubs} />;
};

export default BaseImportStandardFormat;
