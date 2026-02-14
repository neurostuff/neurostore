import { Box, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import {
    retrieveExtractionTableState,
    updateExtractionTableState,
} from 'pages/Extraction/components/ExtractionTable.helpers';
import {
    useCreateNewExclusion,
    useDemoteStub,
    useProjectCurationColumns,
    useProjectCurationIsPrisma,
    useProjectCurationPrismaConfig,
    useProjectExtractionStudysetId,
    useProjectId,
    useRemoveStudyListStatus,
    useSetExclusionForStub,
} from 'pages/Project/store/ProjectStore';
import { ENeurosynthTagIds, PRISMAEligibilityExclusionTags } from 'pages/Project/store/ProjectStore.consts';
import { ICurationColumn, ICurationStubStudy } from 'pages/Curation/Curation.types';
import { useStudyId } from '../store/StudyStore';
import { useGetStudysetById, useUpdateStudyset } from 'hooks';

const defaultInsufficientDetailsExclusion =
    PRISMAEligibilityExclusionTags[ENeurosynthTagIds.INSUFFICIENT_DETAIL_EXCLUSION_ID];

const RelegateExtractionStudyDialog: React.FC<{ isOpen: boolean; onCloseDialog: (confirm: boolean) => void }> = ({
    isOpen,
    onCloseDialog,
}) => {
    const isPrisma = useProjectCurationIsPrisma();
    const projectId = useProjectId();
    const removeStudyListStatus = useRemoveStudyListStatus();
    const studyId = useStudyId();
    const studysetId = useProjectExtractionStudysetId();
    const { data: studyset } = useGetStudysetById(studysetId || undefined, false);
    const { mutateAsync: updateStudyset, isLoading } = useUpdateStudyset();
    const demoteStub = useDemoteStub();
    const setExclusionForStub = useSetExclusionForStub();
    const createExclusion = useCreateNewExclusion();
    const prismaConfig = useProjectCurationPrismaConfig();
    const columns = useProjectCurationColumns();

    const handleCloseDialog = async (confirm: boolean | undefined) => {
        if (confirm && studyId && studysetId && studyset?.studies) {
            const studysetStudies = [
                ...((studyset?.studyset_studies ?? []) as { id: string; curation_stub_uuid: string }[]),
            ];
            const index = studysetStudies.findIndex((study) => study.id === studyId);
            if (index < 0) throw new Error('study not found in studyset');

            const stubId = studysetStudies[index]?.curation_stub_uuid;
            if (!stubId) throw new Error('curation stub id not found');

            studysetStudies.splice(index, 1);

            // 1. Add exclusion tag to curation phase if it does not exist. If it does exist, nothing will happen
            if (!prismaConfig.isPrisma) createExclusion(defaultInsufficientDetailsExclusion, undefined);

            // 2. find stub in curation and move to eligibility phase. add exclusion tag.
            const currentColumnIndex = columns.findIndex((col: ICurationColumn) =>
                col.stubStudies.some((stub: ICurationStubStudy) => stub.id === stubId)
            );
            demoteStub(currentColumnIndex, stubId);
            setExclusionForStub(currentColumnIndex - 1, stubId, ENeurosynthTagIds.INSUFFICIENT_DETAIL_EXCLUSION_ID);

            // 3. remove from extraction studylist metadata
            removeStudyListStatus(studyId);

            // 4. update extraction table state
            if (projectId) {
                const extractionState = retrieveExtractionTableState(projectId);
                if (extractionState) {
                    const newStudies = extractionState.studies.filter((id) => id !== studyId);
                    updateExtractionTableState(projectId, { studies: newStudies });
                }
            }

            // 5. update studyset
            await updateStudyset({
                studysetId: studysetId,
                studyset: {
                    studies: studysetStudies,
                },
            });
        }

        onCloseDialog(!!confirm);
    };

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            confirmButtonProps={{ isLoading, loaderColor: 'secondary' }}
            onCloseDialog={handleCloseDialog}
            dialogTitle="Coordinates could not be found for this study."
            confirmText="Continue"
            rejectText="Cancel"
            dialogMessage={
                <Box sx={{ mb: 3 }}>
                    <Typography gutterBottom variant="body2"></Typography>
                    <Typography gutterBottom variant="body2">
                        This study will be removed from the extraction phase,{' '}
                        {isPrisma
                            ? `and will be moved to the "eligibility" phase in curation.`
                            : `and will be moved back to "Unreviewed" in the curation phase.`}
                    </Typography>
                    <Typography gutterBottom variant="body2">
                        It will be excluded with the label:{' '}
                        <span style={{ fontWeight: 'bold', color: 'salmon' }}>Insufficient Details</span>
                    </Typography>
                </Box>
            }
        ></ConfirmationDialog>
    );
};

export default RelegateExtractionStudyDialog;
