import { Box, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import {
    useAddTagToStub,
    useDemoteStub,
    useProjectCurationIsPrisma,
    useProjectExclusionTag,
    useProjectExtractionStudysetId,
    useRemoveStudyListStatus,
} from 'pages/Project/store/ProjectStore';
import { useStudyId } from '../store/StudyStore';
import { useGetStudysetById, useUpdateStudyset } from 'hooks';
import { StudysetReturnRelationshipsStudysetStudiesInner } from 'neurostore-typescript-sdk';

const RelegateExtractionStudyDialog: React.FC<{ isOpen: boolean; onCloseDialog: () => void }> = ({
    isOpen,
    onCloseDialog,
}) => {
    const isPrisma = useProjectCurationIsPrisma();
    const removeStudyListStatus = useRemoveStudyListStatus();
    const studyId = useStudyId();
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetById(studysetId || undefined, false);
    const { mutateAsync: updateStudyset } = useUpdateStudyset();
    const demoteStub = useDemoteStub();
    const abc = useProjectExclusionTag();

    const handleCloseDialog = async (confirm: boolean | undefined) => {
        if (confirm && studyId && studysetId && studyset?.studies) {
            const studysetStudies = [
                ...((studyset?.studyset_studies ?? []) as { id: string; curation_stub_uuid: string }[]),
            ];
            const index = studysetStudies.findIndex((study) => study.id === studyId);
            if (index < 0) throw new Error('study not found in studyset');
            studysetStudies.splice(index, 1);

            await updateStudyset({
                studysetId: studysetId,
                studyset: {
                    studies: studysetStudies,
                },
            });

            // 4. remove study from studyset
            // 2. find stub in curation and move to eligibility phase. add exclusion tag.
            // 1. remove from extraction studylist metadata
            // 3. update extraction table state
            removeStudyListStatus(studyId);
        }

        onCloseDialog();
    };

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            onCloseDialog={handleCloseDialog}
            dialogTitle="Coordinates could not be found for this study."
            confirmText="Continue"
            rejectText="Cancel"
            dialogMessage={
                <Box sx={{ mb: 3 }}>
                    <Typography gutterBottom variant="body2">
                        This study will be removed from the extraction phase.
                    </Typography>
                    <Typography gutterBottom variant="body2">
                        {isPrisma
                            ? `It will be moved to the "eligibiliy" phase in curation and excluded with the label: `
                            : `It will be moved back to "Unreviewed" in the curation phase and excluded with the label: `}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            display: 'inline-block',
                            fontWeight: 'bold',
                            backgroundColor: 'salmon',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                        }}
                    >
                        Insufficient Details
                    </Typography>
                </Box>
            }
        ></ConfirmationDialog>
    );
};

export default RelegateExtractionStudyDialog;
