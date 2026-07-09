import CloseIcon from '@mui/icons-material/Close';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import { Button, Card, CardActions, CardContent, CircularProgress, Typography } from '@mui/material';
import { Box } from '@mui/system';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import ProjectComponentsStyles from 'pages/Project/components/Project.styles';
import useGetCurationSummary, { ICurationSummary } from 'hooks/useGetCurationSummary';
import { useNavigate } from 'react-router-dom';
import CurationStepStyles from './ProjectCurationStep.style';

const getPercentageComplete = (curationSummary: ICurationSummary): number => {
    if (curationSummary.total === 0) return 0;
    const percentageComplete = ((curationSummary.included + curationSummary.excluded) / curationSummary.total) * 100;
    return Math.round(percentageComplete);
};
const ProjectCurationStepCard: React.FC<{ projectId: string | undefined; disabled: boolean }> = ({
    projectId,
    disabled,
}) => {
    const navigate = useNavigate();
    const curationSummary = useGetCurationSummary();

    if (!projectId) {
        return <NeurosynthLoader loaded={false} />;
    }

    return (
        <Box sx={[ProjectComponentsStyles.stepCard]}>
            <Card
                sx={{
                    width: '100%',
                    height: '100%',
                    minHeight: '165px',
                    padding: '8px',
                }}
            >
                <CardContent>
                    <Box sx={ProjectComponentsStyles.stepTitle}>
                        <Typography sx={{ color: 'muted.main' }}>{curationSummary.total} studies</Typography>
                        <CircularProgress
                            color={getPercentageComplete(curationSummary) === 100 ? 'success' : 'secondary'}
                            sx={ProjectComponentsStyles.progressCircle}
                            variant="determinate"
                            value={getPercentageComplete(curationSummary)}
                        />
                    </Box>
                    <Typography gutterBottom variant="h5">
                        Study Curation Summary
                    </Typography>
                    <Box sx={ProjectComponentsStyles.statusContainer}>
                        <Box sx={ProjectComponentsStyles.statusIconContainer}>
                            <QuestionMarkIcon sx={CurationStepStyles.questionMarkIcon} />
                            <Typography sx={{ color: 'warning.dark' }}>
                                {curationSummary.uncategorized} uncategorized
                            </Typography>
                        </Box>
                        <Box sx={ProjectComponentsStyles.statusIconContainer}>
                            <CloseIcon sx={CurationStepStyles.closeIcon} />
                            <Typography sx={{ color: 'error.dark' }}>{curationSummary.excluded} excluded</Typography>
                        </Box>
                        <Box sx={ProjectComponentsStyles.statusIconContainer}>
                            <PlaylistAddCheckIcon sx={CurationStepStyles.checkIcon} />
                            <Typography sx={{ color: 'success.main' }}>{curationSummary.included} included</Typography>
                        </Box>
                    </Box>
                </CardContent>
                <CardActions>
                    <Button
                        color={disabled ? 'primary' : 'secondary'}
                        onClick={() => {
                            navigate(`/projects/${projectId}/curation`);
                        }}
                        variant="text"
                    >
                        {disabled ? 'view curation' : 'continue editing'}
                    </Button>
                </CardActions>
            </Card>
        </Box>
    );
};

export default ProjectCurationStepCard;
