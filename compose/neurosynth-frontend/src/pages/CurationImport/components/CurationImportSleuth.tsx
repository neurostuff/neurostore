import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { useState } from 'react';
import { ISleuthFileUploadStubs } from '../helpers';
import { IImportArgs } from './CurationImportDoImport';
import CurationImportSleuthIngest from './CurationImportSleuthIngest';
import CurationImportSleuthUpload from './CurationImportSleuthUpload';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

const CurationImportSleuth: React.FC<
    IImportArgs & {
        onFileUpload: (fileName: string) => void;
    }
> = ({ onFileUpload, onImportStubs, onNavigate }) => {
    const [uploadFilePhase, setUploadFilePhase] = useState(true);
    const [sleuthUploads, setSleuthUploads] = useState<ISleuthFileUploadStubs[]>([]);

    const handleUploadFiles = (sleuthUploads: ISleuthFileUploadStubs[]) => {
        setSleuthUploads(sleuthUploads);
        onFileUpload(
            sleuthUploads.reduce((acc, curr, index) => {
                return index === 0 ? curr.fileName : `${acc}, ${curr.fileName}`;
            }, '')
        );
        setUploadFilePhase(false);
    };

    const handleOnStubSuploaded = (stubs: ICurationStubStudy[]) => {
        onImportStubs(stubs);
        onNavigate(ENavigationButton.NEXT);
    };

    if (uploadFilePhase) {
        return (
            <CurationImportSleuthUpload
                onNext={handleUploadFiles}
                onPrevious={() => {
                    onNavigate(ENavigationButton.PREV);
                }}
            />
        );
    }

    return <CurationImportSleuthIngest onStubsUploaded={handleOnStubSuploaded} sleuthUploads={sleuthUploads} />;
};

export default CurationImportSleuth;
