import { hasDuplicates } from 'pages/CurationImport/CurationImport.helpers';
import { IImportArgs } from './CurationImportDoImport';
import CurationImportResolveDuplicatesImport from './CurationImportResolveDuplicatesImport';
import CurationImportStandardFormatUpload from './CurationImportStandardFormatUpload';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

const CurationImportStandardFormat: React.FC<IImportArgs> = (props) => {
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
            <CurationImportResolveDuplicatesImport
                onNavigate={() => onIsResolvingDuplicates(false)}
                onImportStubs={handleResolveStubs}
                stubs={stubs}
            />
        );
    }

    return (
        <CurationImportStandardFormatUpload
            onNavigate={onNavigate}
            onImportStubs={handleImportStubs}
        />
    );
};

export default CurationImportStandardFormat;
