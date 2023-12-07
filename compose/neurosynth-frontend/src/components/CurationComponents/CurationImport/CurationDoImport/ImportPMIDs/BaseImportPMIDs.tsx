import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import React from 'react';
import { useState } from 'react';
import { hasDuplicates } from '../../helpers/utils';
import { IImportArgs } from '../CurationDoImport';
import ResolveImportDuplicates from '../ResolveImportDuplicates/ResolveImportDuplicates';
import FetchPMIDs from './FetchPMIDs';
import UploadPMIDs from './UploadPMIDs';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';

const BaseImportPMIDs: React.FC<IImportArgs> = (props) => {
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
            <UploadPMIDs onNavigate={onNavigate} onPubmedIdsUploaded={handlePubmedIdsUploaded} />
        );
    }

    if (isResolvingDuplicates) {
        return (
            <ResolveImportDuplicates
                stubs={stubs}
                onNavigate={onNavigate}
                onImportStubs={handleResolveStubs}
            />
        );
    }

    return <FetchPMIDs onStubsUploaded={handleStubsRetrieved} pubmedIds={parsedIds} />;
};

export default BaseImportPMIDs;
