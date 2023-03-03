import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import React from 'react';
import { useState } from 'react';
import FetchPMIDs from './FetchPMIDs';
import UploadPMIDs from './UploadPMIDs';

const BaseImportPMIDs: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[]) => void;
}> = (props) => {
    const { onNavigate, onImportStubs } = props;

    const [uploadIdsPhase, setUploadIdsPhase] = useState(true);
    const [parsedIds, setParsedIds] = useState<string[]>([]);

    const handleMoveToFetchStudiesPhase = (parsedIds: string[]) => {
        setParsedIds(parsedIds);
        setUploadIdsPhase(false);
    };

    const handleStubsUploaded = React.useCallback(
        (stubs: ICurationStubStudy[]) => {
            onImportStubs(stubs);
        },
        [onImportStubs]
    );

    if (uploadIdsPhase) {
        return (
            <UploadPMIDs
                onNavigate={onNavigate}
                onFetchPubmedStudies={handleMoveToFetchStudiesPhase}
            />
        );
    }

    return <FetchPMIDs onStubsUploaded={handleStubsUploaded} pubmedIds={parsedIds} />;
};

export default BaseImportPMIDs;
