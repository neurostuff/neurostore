import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import React from 'react';
import { useState } from 'react';
import { hasDuplicates } from '../../helpers/utils';
import { IImportArgs } from '../CurationDoImport';
import ResolveImportDuplicates from '../ResolveImportDuplicates/ResolveImportDuplicates';
import FetchPMIDs from './FetchPMIDs';
import UploadPMIDs from './UploadPMIDs';

const BaseImportPMIDs: React.FC<IImportArgs> = (props) => {
    const { onNavigate, onImportStubs, onIsResolvingDuplicates, isResolvingDuplicates } = props;

    const [uploadIdsPhase, setUploadIdsPhase] = useState(true);
    const [parsedIds, setParsedIds] = useState<string[]>([]);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);

    const handlePubmedIdsUploaded = (parsedIds: string[]) => {
        setParsedIds(parsedIds);
        setUploadIdsPhase(false);
    };

    const handleStubsRetrieved = React.useCallback(
        (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => {
            const duplicatesExist = hasDuplicates(stubs);
            if (duplicatesExist) {
                onIsResolvingDuplicates(true);
                setStubs(stubs);
            } else {
                onIsResolvingDuplicates(false);
                onImportStubs(stubs, unimportedStubs);
            }
        },
        [onImportStubs, onIsResolvingDuplicates]
    );

    const handleDuplicateStubsResolved = (updatedStubs: ICurationStubStudy[]) => {
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
                onResolveStubs={handleDuplicateStubsResolved}
            />
        );
    }

    return <FetchPMIDs onStubsUploaded={handleStubsRetrieved} pubmedIds={parsedIds} />;
};

export default BaseImportPMIDs;
