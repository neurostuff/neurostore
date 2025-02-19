import React, { useState } from 'react';
import { IImportArgs } from './CurationImportDoImport';
import CurationImportPMIDsFetch from './CurationImportPMIDsFetch';
import CurationImportPMIDsUpload from './CurationImportPMIDsUpload';

const CurationImportPMIDs: React.FC<IImportArgs> = (props) => {
    const { onNavigate, onImportStubs } = props;

    const [uploadIdsPhase, setUploadIdsPhase] = useState(true);
    const [parsedIds, setParsedIds] = useState<string[]>([]);

    const handlePubmedIdsUploaded = (parsedIds: string[]) => {
        setParsedIds(parsedIds);
        setUploadIdsPhase(false);
    };

    if (uploadIdsPhase) {
        return <CurationImportPMIDsUpload onNavigate={onNavigate} onPubmedIdsUploaded={handlePubmedIdsUploaded} />;
    }

    return <CurationImportPMIDsFetch onStubsUploaded={onImportStubs} pubmedIds={parsedIds} />;
};

export default CurationImportPMIDs;
