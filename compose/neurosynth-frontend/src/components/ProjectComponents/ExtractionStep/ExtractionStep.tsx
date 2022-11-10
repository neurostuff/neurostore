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
    Divider,
    CircularProgress,
} from '@mui/material';
import { useState } from 'react';
import ProjectComponentsStyles from '../ProjectComponents.styles';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { useHistory } from 'react-router-dom';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

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
                        {hasStudyset ? (
                            <Box sx={[ProjectComponentsStyles.stepCard]}>
                                <Card>
                                    <CardContent>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                position: 'relative',
                                            }}
                                        >
                                            <Typography sx={{ color: 'muted.main' }}>
                                                43 studies
                                            </Typography>
                                            <CircularProgress
                                                sx={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    backgroundColor: '#ededed',
                                                    borderRadius: '50%',
                                                }}
                                                variant="determinate"
                                                value={Math.round((12 / 43) * 100)}
                                            />
                                        </Box>
                                        <Typography
                                            gutterBottom
                                            variant="h5"
                                            sx={{ marginRight: '40px' }}
                                        >
                                            Studyset name
                                        </Typography>
                                        <TextExpansion
                                            textSx={{ color: 'muted.main' }}
                                            text="Lorem ipsum dolor sit amet consectetur, adipisicing
                                            elit. Non, doloribus ex atque sit rem necessitatibus
                                            minima unde harum exercitationem quas, autem alias
                                            quidem voluptate, corrupti ullam repellat accusantium
                                            quia vel."
                                        />
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
                                                <CheckCircleOutlineIcon
                                                    sx={{
                                                        color: 'success.main',
                                                        marginBottom: '5px',
                                                    }}
                                                />
                                                <Typography
                                                    sx={{
                                                        color: 'success.main',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    12 completed
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Divider
                                                    sx={{ margin: '0 10px' }}
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
                                                <Typography
                                                    sx={{
                                                        color: 'warning.dark',
                                                        marginTop: '29px',
                                                    }}
                                                >
                                                    20 uncategorized
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Divider
                                                    sx={{ margin: '0 10px' }}
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
                                                <AccessTimeIcon
                                                    sx={{
                                                        color: 'muted.main',
                                                        marginBottom: '5px',
                                                    }}
                                                />
                                                <Typography sx={{ color: 'muted.main' }}>
                                                    11 saved for later
                                                </Typography>
                                            </Box>
                                        </Box>
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
                        ) : (
                            <Tooltip
                                placement="right"
                                title={
                                    props.disabled
                                        ? 'You must complete the previous step first'
                                        : ''
                                }
                            >
                                <Box
                                    sx={[
                                        ProjectComponentsStyles.stepCard,
                                        ProjectComponentsStyles.getStartedContainer,
                                        {
                                            borderColor: props.disabled
                                                ? 'lightgray'
                                                : 'primary.main',
                                        },
                                    ]}
                                >
                                    <Button
                                        sx={{ width: '100%', height: '100%' }}
                                        disabled={props.disabled}
                                        endIcon={<KeyboardArrowDown />}
                                        onClick={() => setHasStudyset(true)}
                                    >
                                        Extraction & Annotation: get started
                                    </Button>
                                </Box>
                            </Tooltip>
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default ExtractionStep;
