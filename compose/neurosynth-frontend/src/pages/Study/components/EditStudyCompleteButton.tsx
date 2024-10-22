import { Box } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudyStatus,
} from 'pages/Project/store/ProjectStore';
import React from 'react';
import { useParams } from 'react-router-dom';
import useSaveStudy from '../hooks/useSaveStudy';

const EditStudyCompleteButton: React.FC = React.memo((props) => {
    const { studyId } = useParams<{ studyId: string }>();
    const { isLoading, hasEdits, handleSave } = useSaveStudy();
    const extractionStatus = useProjectExtractionStudyStatus(studyId || '');
    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    const handleSaveAndComplete = async () => {
        let clonedId: string | undefined;
        if (hasEdits) {
            clonedId = await handleSave(); // this will only save if there are changes
        }
        if (extractionStatus?.status !== EExtractionStatus.COMPLETED) {
            updateStudyListStatus(clonedId || studyId || '', EExtractionStatus.COMPLETED);
        }
    };

    return (
        <Box>
            <LoadingButton
                sx={{ width: '175px' }}
                variant="contained"
                color="success"
                size="small"
                disabled={extractionStatus?.status === EExtractionStatus.COMPLETED}
                disableElevation
                loaderColor="secondary"
                isLoading={isLoading}
                onClick={handleSaveAndComplete}
                text={
                    extractionStatus?.status === EExtractionStatus.COMPLETED
                        ? 'Completed'
                        : 'Mark as Complete'
                }
            />
        </Box>
    );
});

export default EditStudyCompleteButton;
