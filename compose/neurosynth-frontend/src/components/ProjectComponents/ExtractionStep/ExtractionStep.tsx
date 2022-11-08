import {
    Step,
    StepLabel,
    StepContent,
    Typography,
    Box,
    Card,
    CardContent,
    Button,
    CardActions,
    Tooltip,
    StepProps,
} from '@mui/material';
import { useState } from 'react';
import ProjectComponentsStyles from '../ProjectComponents.styles';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { useHistory } from 'react-router-dom';

interface IExtractionStep {
    disabled?: boolean;
}

const ExtractionStep: React.FC<IExtractionStep & StepProps> = (props) => {
    const history = useHistory();
    const [hasStudyset, setHasStudyset] = useState(false);

    return (
        <Step {...props} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography
                    sx={{ color: props.disabled ? 'muted.main' : 'primary.main' }}
                    variant="h6"
                >
                    <b>Extraction & Annotation</b>: Add relevent study data
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        <b>
                            You have now completed your search and have a list of studies you would
                            like to include in your meta-analysis
                        </b>
                        <br />
                        In this step, add study data (like coordinates and metadata) as well as
                        relevant analysis annotations
                    </Typography>

                    <Box>
                        {props.disabled ? (
                            <Tooltip
                                placement="right"
                                title={
                                    hasStudyset ? '' : 'You must complete the previous step first'
                                }
                            >
                                <Box
                                    sx={[
                                        ProjectComponentsStyles.stepCard,
                                        ProjectComponentsStyles.getStartedContainer,
                                        { borderColor: hasStudyset ? 'primary.main' : 'lightgray' },
                                    ]}
                                >
                                    <Button
                                        sx={{ width: '100%', height: '100%' }}
                                        disabled
                                        endIcon={<KeyboardArrowDown />}
                                    >
                                        Extraction & Annotation: get started
                                    </Button>
                                </Box>
                            </Tooltip>
                        ) : (
                            <Box sx={[ProjectComponentsStyles.stepCard]}>
                                <Card>
                                    <CardContent>
                                        <Typography gutterBottom sx={{ color: 'muted.main' }}>
                                            43 studies
                                        </Typography>
                                        <Typography gutterBottom variant="h5">
                                            Studyset name
                                        </Typography>
                                        <Typography gutterBottom sx={{ color: 'muted.main' }}>
                                            Lorem ipsum dolor sit amet consectetur, adipisicing
                                            elit. Non, doloribus ex atque sit rem necessitatibus
                                            minima unde harum exercitationem quas, autem alias
                                            quidem voluptate, corrupti ullam repellat accusantium
                                            quia vel.
                                        </Typography>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            onClick={() => history.push('/projects/1/extraction')}
                                            variant="text"
                                        >
                                            continue editing
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Box>
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

{
    /* <Box sx={[ProjectComponentsStyles.stepCard]}>
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
                    <Typography sx={{ color: 'success.main' }}>30 included</Typography>
                </Box>
                <Box>
                    <Divider sx={{ margin: '0 20px' }} orientation="vertical" />
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
                    <Typography sx={{ color: 'warning.dark' }}>31 Uncategorized</Typography>
                </Box>
                <Box>
                    <Divider sx={{ margin: '0 20px' }} orientation="vertical" />
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
                    <Typography sx={{ color: 'error.dark' }}>372 excluded</Typography>
                </Box>
            </Box>
        </CardContent>
        <CardActions>
            <Button
                onClick={() => history.push(`/projects/${params.projectId}/curation`)}
                variant="text"
            >
                continue editing
            </Button>
        </CardActions>
    </Card>
</Box>; */
}

export default ExtractionStep;
