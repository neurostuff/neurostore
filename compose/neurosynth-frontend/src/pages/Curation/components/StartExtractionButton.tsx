import { Typography, Box, Button, ButtonProps } from '@mui/material';
import { useGetCurationSummary, useGetStudysetById, useUserCanEdit } from 'hooks';
import {
    useProjectCurationColumns,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectId,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { enqueueSnackbar, SnackbarKey, closeSnackbar } from 'notistack';
import { useCurationBoardGroups } from '../context/CurationBoardGroupsContext';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import { useNavigate } from 'react-router-dom';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';

const StartExtractionButton: React.FC<ButtonProps> = (props) => {
    const { included, uncategorized } = useGetCurationSummary();
    const columns = useProjectCurationColumns();
    const { groups, handleSetSelectedGroup } = useCurationBoardGroups();
    const navigate = useNavigate();
    const studysetId = useProjectExtractionStudysetId();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: studyset } = useGetStudysetById(studysetId || '', false);
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const canMoveToExtractionPhase = included > 0 && uncategorized === 0;
    const extractionStepInitialized = !!studysetId && annotationId && (studyset?.studies?.length || 0) > 0;
    const indicateGoToExtraction = !extractionStepInitialized && canMoveToExtractionPhase;
    const projectId = useProjectId();

    const handleNavigateToStep = (groupId: string, snackbarId: SnackbarKey) => {
        const foundGroup = groups.find((g) => g.id === groupId);
        if (foundGroup) {
            handleSetSelectedGroup(foundGroup);
        }
        closeSnackbar(snackbarId);
    };

    const handleMoveToExtractionPhase = () => {
        if (!canMoveToExtractionPhase) {
            const existingIssues: { phase: string; colId: string; numUncategorized: number }[] = [];
            for (let i = 0; i < columns.length - 1; i++) {
                // skip the last column as it is included
                const column = columns[i];
                const numUncategorized = column.stubStudies.filter((s) => s.exclusionTag === null).length;
                if (numUncategorized > 0) {
                    existingIssues.push({ phase: column.name, colId: column.id, numUncategorized });
                }
            }

            const snackbarId = enqueueSnackbar(
                <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }} gutterBottom>
                        You must complete curation before moving to extraction
                    </Typography>
                    {existingIssues.map((issue) => (
                        <Typography key={issue.phase} variant="body2">
                            The <b>{issue.phase}</b> step still has <b>{issue.numUncategorized} studies</b> that need to
                            be either <b>included</b> or <b>excluded</b>.
                        </Typography>
                    ))}

                    <Box sx={{ marginTop: '1rem' }}>
                        {existingIssues.map((issue) => (
                            <Button
                                key={issue.phase}
                                sx={{ margin: '4px' }}
                                variant="contained"
                                color="primary"
                                disableElevation
                                size="small"
                                onClick={() => handleNavigateToStep(issue.colId, snackbarId)}
                            >
                                Go to {issue.phase}
                            </Button>
                        ))}
                    </Box>
                </Box>,
                { variant: 'warning', autoHideDuration: null }
            );
            return;
        } else if (extractionStepInitialized) {
            navigate(`/projects/${projectId}/extraction`);
        } else {
            navigate(`/projects/${projectId}/project`, {
                state: {
                    projectPage: {
                        openCurationDialog: true,
                    },
                } as IProjectPageLocationState,
            });
        }
    };

    return (
        <Button
            variant={canMoveToExtractionPhase ? 'contained' : 'outlined'}
            disabled={!canEdit}
            color="success"
            size="small"
            disableElevation
            onClick={handleMoveToExtractionPhase}
            {...props}
        >
            {indicateGoToExtraction && <PriorityHighIcon sx={{ fontSize: '16px', marginRight: '4px' }} />}
            {extractionStepInitialized ? 'view extraction' : 'start extraction'}
        </Button>
    );
};

export default StartExtractionButton;
