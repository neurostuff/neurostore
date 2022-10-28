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
import NavPopupMenu from 'components/Navbar/NavSubMenu/NavPopupMenu';

interface IExtractionStep {}

const ExtractionStep: React.FC<IExtractionStep & StepProps> = (props) => {
    const [hasStudyset, setHasStudyset] = useState(false);

    return (
        <Step {...props} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography
                    sx={{ color: hasStudyset ? 'primary.main' : 'muted.main' }}
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
                            <Card sx={[ProjectComponentsStyles.stepCard]}>
                                <CardContent>
                                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                                        43 studies
                                    </Typography>
                                    <Typography gutterBottom variant="h5">
                                        Studyset name
                                    </Typography>
                                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                                        Lorem ipsum dolor sit amet consectetur, adipisicing elit.
                                        Non, doloribus ex atque sit rem necessitatibus minima unde
                                        harum exercitationem quas, autem alias quidem voluptate,
                                        corrupti ullam repellat accusantium quia vel.
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button variant="text">continue editing</Button>
                                </CardActions>
                            </Card>
                        ) : (
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
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default ExtractionStep;
