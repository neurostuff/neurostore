import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { useState } from 'react';
import { ISleuthFileUploadStubs } from '../helpers';
import { IImportArgs } from './ImportDoImport';
import ImportSleuthIngest from './ImportSleuthIngest';
import ImportSleuthUpload from './ImportSleuthUpload';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

const ImportSleuth = ({  onFileUpload, onImportStubs, onNavigate  }: 
    IImportArgs & {
        onFileUpload: (fileName: string) => void;
    }
) => {
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
            <ImportSleuthUpload
                onNext={handleUploadFiles}
                onPrevious={() => {
                    onNavigate(ENavigationButton.PREV);
                }}
            />
        );
    }

    return <ImportSleuthIngest onStubsUploaded={handleOnStubSuploaded} sleuthUploads={sleuthUploads} />;
};

export default ImportSleuth;
