import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import {
    Box,
    Step,
    StepContent,
    StepLabel,
    StepProps,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    CardActions,
    Button,
    Divider,
} from '@mui/material';
import NavToolbarPopupSubMenu from 'components/Navbar/NavSubMenu/NavToolbarPopupSubMenu';
import { IExtractionMetadata } from 'hooks/requests/useGetProjects';
import { useHistory, useParams } from 'react-router-dom';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';

interface IExtractionStep {
    extractionMetadata: IExtractionMetadata | undefined;
    disabled: boolean;
}

const ExtractionStep: React.FC<IExtractionStep & StepProps> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const history = useHistory();
    const { extractionMetadata, disabled, ...stepProps } = props;

    const extractionMetadataExists = !!extractionMetadata;

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Extraction & Annotation</b>: Add relevant study data
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>
                            You have completed your study curation, and now have a studyset full of
                            studies that you would like to include in your meta-analysis
                        </b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        In this step, add necessary study data to the studies in your studyset (like
                        coordinates and metadata) as well as analysis annotations that will be used
                        to help filter analyses within your studies
                    </Typography>
                    <Box sx={{ marginTop: '1rem' }}>
                        {extractionMetadataExists ? (
                            <Box sx={[ProjectStepComponentsStyles.stepCard]}>
                                <Card sx={{ width: '100%', height: '100%' }}>
                                    <CardContent>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                position: 'relative',
                                            }}
                                        >
                                            <Typography sx={{ color: 'muted.main' }}>
                                                433 studies
                                            </Typography>
                                            <CircularProgress
                                                sx={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    backgroundColor: '#ededed',
                                                    borderRadius: '50%',
                                                }}
                                                variant="determinate"
                                                value={Math.round(((30 + 372) / 433) * 100)}
                                            />
                                        </Box>
                                        <Typography
                                            gutterBottom
                                            variant="h5"
                                            sx={{ marginRight: '40px' }}
                                        >
                                            Study Curation Summary
                                        </Typography>
                                        <Box
                                            sx={{
                                                marginTop: '1.5rem',
                                                display: 'flex',
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <CheckIcon
                                                    sx={{
                                                        color: 'success.main',
                                                        marginBottom: '5px',
                                                    }}
                                                />
                                                <Typography sx={{ color: 'success.main' }}>
                                                    30 included
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Divider
                                                    sx={{ margin: '0 20px' }}
                                                    orientation="vertical"
                                                />
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <QuestionMarkIcon
                                                    sx={{
                                                        color: 'warning.dark',
                                                        marginBottom: '5px',
                                                    }}
                                                />
                                                <Typography sx={{ color: 'warning.dark' }}>
                                                    31 uncategorized
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Divider
                                                    sx={{ margin: '0 20px' }}
                                                    orientation="vertical"
                                                />
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <CloseIcon
                                                    sx={{
                                                        color: 'error.dark',
                                                        marginBottom: '5px',
                                                    }}
                                                />
                                                <Typography sx={{ color: 'error.dark' }}>
                                                    372 excluded
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            onClick={() =>
                                                history.push(`/projects/${projectId}/curation`)
                                            }
                                            variant="text"
                                        >
                                            continue editing
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Box>
                        ) : (
                            <Box
                                sx={[
                                    ProjectStepComponentsStyles.stepCard,
                                    ProjectStepComponentsStyles.getStartedContainer,
                                    { borderColor: disabled ? 'muted.main' : 'primary.main' },
                                ]}
                            >
                                <Button disabled={disabled} sx={{ width: '100%', height: '100%' }}>
                                    extraction: get started
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default ExtractionStep;
