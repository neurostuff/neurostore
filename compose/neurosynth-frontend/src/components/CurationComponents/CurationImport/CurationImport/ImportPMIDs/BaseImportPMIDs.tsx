import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import React from 'react';
import { useState } from 'react';
import { IImportArgs } from '../CurationImport';
import ResolveImportDuplicates, {
    extractDuplicates,
} from '../ResolveImportDuplicates/ResolveImportDuplicates';
import FetchPMIDs from './FetchPMIDs';
import UploadPMIDs from './UploadPMIDs';

const BaseImportPMIDs: React.FC<IImportArgs> = (props) => {
    const { onNavigate, onImportStubs } = props;

    const [uploadIdsPhase, setUploadIdsPhase] = useState(true);
    const [resolveDuplicates, setResolveDuplicates] = useState(false);
    const [parsedIds, setParsedIds] = useState<string[]>([]);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);

    const handlePubmedIdsUploaded = (parsedIds: string[]) => {
        setParsedIds(parsedIds);
        setUploadIdsPhase(false);
    };

    const handleStubsRetrieved = React.useCallback(
        (stubs: ICurationStubStudy[]) => {
            const duplicates = extractDuplicates(stubs);
            if (duplicates.length > 0) {
                setResolveDuplicates(true);
                setStubs(stubs);
            } else {
                onImportStubs(stubs);
            }
        },
        [onImportStubs]
    );

    const handleDuplicateStubsResolved = (updatedStubs: ICurationStubStudy[]) => {
        props.onImportStubs(updatedStubs);
    };

    if (uploadIdsPhase) {
        return (
            <UploadPMIDs onNavigate={onNavigate} onPubmedIdsUploaded={handlePubmedIdsUploaded} />
        );
    }

    if (resolveDuplicates) {
        return (
            <ResolveImportDuplicates
                stubs={stubs}
                onNavigate={props.onNavigate}
                onResolveStubs={handleDuplicateStubsResolved}
            />
        );
    }

    return <FetchPMIDs onStubsUploaded={handleStubsRetrieved} pubmedIds={parsedIds} />;
};

export default BaseImportPMIDs;
