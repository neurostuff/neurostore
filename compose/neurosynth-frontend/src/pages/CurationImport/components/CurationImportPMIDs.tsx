import React, { useState } from 'react';
import { IImportArgs } from './CurationImportDoImport';
import CurationImportPMIDsFetch from './CurationImportPMIDsFetch';
import CurationImportPMIDsUpload from './CurationImportPMIDsUpload';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';

const CurationImportPMIDs: React.FC<IImportArgs & { onFileUpload: (fileName: string) => void }> = ({
    onNavigate,
    onImportStubs,
    onFileUpload,
}) => {
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
        return (
            <CurationImportPMIDsUpload
                onNavigate={onNavigate}
                onFileUpload={onFileUpload}
                onPubmedIdsUploaded={handlePubmedIdsUploaded}
            />
        );
    }

    return <CurationImportPMIDsFetch onStubsUploaded={handleOnStubsUploaded} pubmedIds={parsedIds} />;
};

export default CurationImportPMIDs;
