import {
    Step,
    StepLabel,
    StepContent,
    Typography,
    Divider,
    Box,
    Card,
    CardContent,
    Button,
    CardActions,
    StepProps,
} from '@mui/material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import ProjectComponentsStyles from '../ProjectComponents.styles';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { useState } from 'react';
import NavPopupMenu from 'components/Navbar/NavSubMenu/NavPopupMenu';
import { useHistory, useParams } from 'react-router-dom';

interface ICurationStep {}

const CurationStep: React.FC<ICurationStep & StepProps> = (props) => {
    const params: { projectId: string } = useParams();
    const { ...stepProps } = props;
    const [hasCuration, setHasCuration] = useState(false);
    const history = useHistory();

    return (
        <Step {...stepProps} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography color="primary" variant="h6">
                    <b>Curation</b>: Import, organize, and include studies of interest
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        <b>The first step when creating a meta-analysis</b>
                        <br />
                        In this step, import studies from PubMed, tag studies, and either exclude
                        studies or include them in your meta-analysis
                    </Typography>

                    <Box>
                        {hasCuration ? (
                            <Box sx={[ProjectComponentsStyles.stepCard]}>
                                <Card sx={{ width: '100%', height: '100%' }}>
                                    <CardContent>
                                        <Typography gutterBottom sx={{ color: 'muted.main' }}>
                                            433 studies
                                        </Typography>
                                        <Typography gutterBottom variant="h5">
                                            Study Curation
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
                                                    31 Uncategorized
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
                                                history.push(
                                                    `/projects/${params.projectId}/curation`
                                                )
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
                                    ProjectComponentsStyles.stepCard,
                                    ProjectComponentsStyles.getStartedContainer,
                                    { borderColor: 'primary.main' },
                                ]}
                            >
                                <NavPopupMenu
                                    options={[
                                        {
                                            label: 'PRISMA Workflow',
                                            secondary:
                                                'Standard prisma workflow and modal use case. Four filtering columns: Identification, Screening, Eligibility, and Included',
                                            onClick: () => {
                                                setHasCuration(true);
                                            },
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
