import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { hasDuplicates } from '../../helpers/utils';
import { IImportArgs } from '../CurationDoImport';
import ResolveImportDuplicates from '../ResolveImportDuplicates/ResolveImportDuplicates';
import ImportStandardFormat from './ImportStandardFormat';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';

const BaseImportStandardFormat: React.FC<IImportArgs> = (props) => {
    const { onNavigate, onImportStubs, onIsResolvingDuplicates, isResolvingDuplicates, stubs } =
        props;

    const handleImportStubs = (stubs: ICurationStubStudy[]) => {
        onImportStubs(stubs);
        const duplicatesExist = hasDuplicates(stubs);
        if (duplicatesExist) {
            onIsResolvingDuplicates(true);
        } else {
            onIsResolvingDuplicates(false);
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
                onNavigate={() => onIsResolvingDuplicates(false)}
                onImportStubs={handleResolveStubs}
                stubs={stubs}
            />
        );
    }

    return <ImportStandardFormat onNavigate={onNavigate} onImportStubs={handleImportStubs} />;
};

export default BaseImportStandardFormat;
