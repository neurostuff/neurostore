import { Box, useMediaQuery, useTheme } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudyStatus,
} from 'pages/Project/store/ProjectStore';
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSaveStudy from '../hooks/useSaveStudy';
import { Check } from '@mui/icons-material';

const EditStudyCompleteButton: React.FC = React.memo(() => {
    const { studyId } = useParams<{ studyId: string }>();
    const { isLoading, hasEdits, handleSave } = useSaveStudy();
    const extractionStatus = useProjectExtractionStudyStatus(studyId || '');
    const updateStudyListStatus = useProjectExtractionAddOrUpdateStudyListStatus();

    const theme = useTheme();
    const mdDown = useMediaQuery(theme.breakpoints.down('md'));

    const handleSaveAndComplete = async () => {
        let clonedId: string | undefined;
        if (hasEdits) {
            clonedId = await handleSave(); // this will only save if there are changes
        }
        if (extractionStatus?.status !== EExtractionStatus.COMPLETED) {
            updateStudyListStatus(clonedId || studyId || '', EExtractionStatus.COMPLETED);
        }
    };

    const buttonText: string | React.ReactNode = useMemo(() => {
        if (mdDown) return <Check />;
        return extractionStatus?.status === EExtractionStatus.COMPLETED ? 'Completed' : 'Mark as Complete';
    }, [mdDown, extractionStatus?.status]);

    return (
        <Box>
            <LoadingButton
                sx={{ width: mdDown ? '40px' : '175px' }}
                variant="contained"
                color="success"
                size="small"
                disabled={extractionStatus?.status === EExtractionStatus.COMPLETED}
                disableElevation
                loaderColor="secondary"
                isLoading={isLoading}
                onClick={handleSaveAndComplete}
                text={buttonText}
            />
        </Box>
    );
});

export default EditStudyCompleteButton;
