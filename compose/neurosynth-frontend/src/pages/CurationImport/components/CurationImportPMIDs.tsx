import React, { useState } from 'react';
import { IImportArgs } from './CurationImportDoImport';
import CurationImportPMIDsFetch from './CurationImportPMIDsFetch';
import CurationImportPMIDsUpload from './CurationImportPMIDsUpload';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';

const CurationImportPMIDs: React.FC<IImportArgs> = (props) => {
    const { onNavigate, onImportStubs } = props;

    const [uploadIdsPhase, setUploadIdsPhase] = useState(true);
    const [parsedIds, setParsedIds] = useState<string[]>([]);

    const handlePubmedIdsUploaded = (parsedIds: string[]) => {
        setParsedIds(parsedIds);
        setUploadIdsPhase(false);
    };

    const handleOnStubsUploaded = (uploadedStubs: ICurationStubStudy[], unimportedStubs?: string[]) => {
        onImportStubs(uploadedStubs, unimportedStubs);
        onNavigate(ENavigationButton.NEXT);
    };

    if (uploadIdsPhase) {
        return <CurationImportPMIDsUpload onNavigate={onNavigate} onPubmedIdsUploaded={handlePubmedIdsUploaded} />;
    }

    return <CurationImportPMIDsFetch onStubsUploaded={handleOnStubsUploaded} pubmedIds={parsedIds} />;
};

export default CurationImportPMIDs;
