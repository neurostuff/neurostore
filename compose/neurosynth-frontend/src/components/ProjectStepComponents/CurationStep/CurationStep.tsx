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
import { ICurationMetadata } from 'hooks/requests/useGetProjects';
import { useHistory, useParams } from 'react-router-dom';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';

interface ICurationStep {
    curationMetadata: ICurationMetadata | undefined;
}

const CurationStep: React.FC<ICurationStep & StepProps> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const history = useHistory();
    const { curationMetadata, ...stepProps } = props;

    const curationMetadataExists = !!curationMetadata;

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>
                <Typography color="primary" variant="h6">
                    <b>Curation</b>: Import, organize, and include studies of interest
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>The first step when creating a meta-analysis</b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        In this step, import studies from PubMed, tag studies, and either exclude
                        from or include studies into your meta-analysis
                    </Typography>
                    <Box sx={{ marginTop: '1rem' }}>
                        {curationMetadataExists ? (
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
                                    { borderColor: 'primary.main' },
                                ]}
                            >
                                <NavToolbarPopupSubMenu
                                    options={[
                                        {
                                            label: 'PRISMA Workflow',
                                            secondary:
                                                'Standard PRISMA workflow and modal use case. Curation step includes four columns: Identification, Screening, Eligibility, and Included',
                                            onClick: () => {},
                                        },
                                        {
                                            label: 'Simple Workflow',
                                            secondary:
                                                'workflow for people who just want to run a meta-analysis on all imported studies',
                                            onClick: () => {},
                                        },
                                        {
                                            label: 'Custom',
                                            secondary:
                                                'specify how many columns you want for a custom workflow for inclusion and exclusion',
                                            onClick: () => {},
                                        },
                                        {
                                            label: 'Reuse a studyset',
                                            secondary:
                                                'Skip this step and run a meta-analysis on an existing studyset',
                                            onClick: () => {},
                                        },
                                    ]}
                                    buttonProps={{
                                        endIcon: <KeyboardArrowDown />,
                                        sx: { width: '100%', height: '100%' },
                                    }}
                                    buttonLabel="curation: get started"
                                />
                            </Box>
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default CurationStep;
