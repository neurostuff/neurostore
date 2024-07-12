import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import React from 'react';
import { useState } from 'react';
import { hasDuplicates } from 'pages/CurationImport/CurationImport.helpers';
import { IImportArgs } from './CurationImportDoImport';
import CurationImportResolveDuplicatesImport from './CurationImportResolveDuplicatesImport';
import CurationImportPMIDsFetch from './CurationImportPMIDsFetch';
import CurationImportPMIDsUpload from './CurationImportPMIDsUpload';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';

const CurationImportPMIDs: React.FC<IImportArgs> = (props) => {
    const { onNavigate, onImportStubs, onIsResolvingDuplicates, isResolvingDuplicates, stubs } =
        props;

    const [uploadIdsPhase, setUploadIdsPhase] = useState(true);
    const [parsedIds, setParsedIds] = useState<string[]>([]);

    const handlePubmedIdsUploaded = (parsedIds: string[]) => {
        setParsedIds(parsedIds);
        setUploadIdsPhase(false);
    };

    const handleStubsRetrieved = React.useCallback(
        (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => {
            onImportStubs(stubs, unimportedStubs);
            const duplicatesExist = hasDuplicates(stubs);
            if (duplicatesExist) {
                onIsResolvingDuplicates(true);
            } else {
                onIsResolvingDuplicates(false);
                onNavigate(ENavigationButton.NEXT);
            }
        },
        [onImportStubs, onIsResolvingDuplicates, onNavigate]
    );

    const handleResolveStubs = (updatedStubs: ICurationStubStudy[]) => {
        onIsResolvingDuplicates(false);
        onImportStubs(updatedStubs);
    };

    if (uploadIdsPhase) {
        return (
            <CurationImportPMIDsUpload
                onNavigate={onNavigate}
                onPubmedIdsUploaded={handlePubmedIdsUploaded}
            />
        );
    }

    if (isResolvingDuplicates) {
        return (
            <CurationImportResolveDuplicatesImport
                stubs={stubs}
                onNavigate={onNavigate}
                onImportStubs={handleResolveStubs}
            />
        );
    }

    return (
        <CurationImportPMIDsFetch onStubsUploaded={handleStubsRetrieved} pubmedIds={parsedIds} />
    );
};

export default CurationImportPMIDs;
