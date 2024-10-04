import { Box, Button } from '@mui/material';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudyStatus,
} from 'pages/Project/store/ProjectStore';
import React from 'react';
import { useParams } from 'react-router-dom';
import useSaveStudy from '../hooks/useSaveStudy';
import LoadingButton from 'components/Buttons/LoadingButton';

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
                sx={{ width: '180px' }}
                variant={
                    extractionStatus?.status === EExtractionStatus.COMPLETED
                        ? 'contained'
                        : 'outlined'
                }
                color="success"
                disableElevation
                loaderColor="secondary"
                isLoading={isLoading}
                onClick={handleSaveAndComplete}
                text={
                    extractionStatus?.status === EExtractionStatus.COMPLETED
                        ? 'Complete'
                        : hasEdits
                        ? 'Save and complete'
                        : 'Set as complete'
                }
            />
        </Box>
    );
});

export default EditStudyCompleteButton;
