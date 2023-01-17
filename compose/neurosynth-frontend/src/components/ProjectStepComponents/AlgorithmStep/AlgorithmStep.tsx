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
import { useHistory, useParams } from 'react-router-dom';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';
import { IAlgorithmMetadata } from 'hooks/requests/useGetProjects';
import { useState } from 'react';
import AlgorithmDialog from 'components/Dialogs/AlgorithmDialog/AlgorithmDialog';

interface IAlgorithmStep {
    algorithmMetadata: IAlgorithmMetadata | undefined;
    disabled: boolean;
}

const FiltrationStep: React.FC<IAlgorithmStep & StepProps> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const history = useHistory();
    const [algorithmDialogIsOpen, setAlgorithmDialogIsOpen] = useState(false);
    const { algorithmMetadata, disabled, ...stepProps } = props;

    const algorithmExists = !!algorithmMetadata;

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Algorithm</b>: Select the desired algorithm and associated arguments
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>
                            You have a finalized studyset full of studies that have all necessary
                            coordinates/data and annotations. You have selected the analyses to use
                            for your meta-analyses.
                        </b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        In this step, select the meta-analytic algorithm that you would like to use
                        as well as associated configurations (kernel size, number of iterations, or
                        associated corrector)
                    </Typography>
                    <AlgorithmDialog
                        isOpen={algorithmDialogIsOpen}
                        onCloseDialog={() => setAlgorithmDialogIsOpen(false)}
                    />
                    <Box sx={{ marginTop: '1rem' }}>
                        {algorithmExists ? (
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
                                <Button
                                    onClick={() => setAlgorithmDialogIsOpen(true)}
                                    disabled={disabled}
                                    sx={{ width: '100%', height: '100%' }}
                                >
                                    algorithm: get started
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default FiltrationStep;
