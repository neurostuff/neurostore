import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import {
    StepProps,
    Step,
    StepLabel,
    Typography,
    StepContent,
    Box,
    Tooltip,
    Button,
    Card,
    CardContent,
    CardActions,
} from '@mui/material';
import FilterDialog from 'components/Dialogs/FilterDialog/FilterDialog';
import { useState } from 'react';
import ProjectComponentsStyles from '../ProjectComponents.styles';

interface IFiltrationStep {
    disabled?: boolean;
}

const FiltrationStep: React.FC<IFiltrationStep & StepProps> = (props) => {
    const [filterDialogIsOpen, setFilterDialogIsOpen] = useState(false);
    const [hasFilter, setHasFilter] = useState(false);

    return (
        <Step {...props} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography
                    sx={{ color: props.disabled ? 'muted.main' : 'primary.main' }}
                    variant="h6"
                >
                    <b>Filtration</b>: Select the analyses to include
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        <b>
                            Your studyset's studies now have all the relevant information (i.e
                            metadata, coordinates, annotations) needed for a meta-analysis
                        </b>
                        <br />
                        In this step, select the analyses from each study that you want to include
                        in the meta-analysis based on your analysis annotations
                    </Typography>

                    {hasFilter ? (
                        <Box sx={ProjectComponentsStyles.stepCard}>
                            <Card sx={{ width: '100%', height: '100%' }}>
                                <CardContent>
                                    <Typography gutterBottom variant="h5">
                                        Filtration Step
                                    </Typography>
                                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                                        Filtering analyses where{' '}
                                        <Box
                                            component="span"
                                            sx={{
                                                backgroundColor: 'lightgray',
                                                color: 'white',
                                                fontWeight: 'bold',
                                                padding: '3px',
                                                borderRadius: '8px',
                                            }}
                                        >
                                            included (default)
                                        </Box>{' '}
                                        is{' '}
                                        <Box
                                            component="span"
                                            sx={{
                                                backgroundColor: 'lightgray',
                                                color: 'white',
                                                fontWeight: 'bold',
                                                padding: '3px',
                                                whiteSpace: 'nowrap',
                                                borderRadius: '8px',
                                            }}
                                        >
                                            equal to true
                                        </Box>
                                    </Typography>
                                    <FilterDialog
                                        isOpen={filterDialogIsOpen}
                                        onCloseDialog={() => setFilterDialogIsOpen(false)}
                                    />
                                </CardContent>
                                <CardActions>
                                    <Button
                                        onClick={() => setFilterDialogIsOpen(true)}
                                        variant="text"
                                    >
                                        modify filter
                                    </Button>
                                </CardActions>
                            </Card>
                        </Box>
                    ) : (
                        <Tooltip
                            placement="right"
                            title={
                                props.disabled ? 'You must complete the previous step first' : ''
                            }
                        >
                            <Box
                                sx={[
                                    ProjectComponentsStyles.stepCard,
                                    ProjectComponentsStyles.getStartedContainer,
                                    { borderColor: props.disabled ? 'lightgray' : 'primary.main' },
                                ]}
                            >
                                <Button
                                    sx={{ width: '100%', height: '100%' }}
                                    disabled={props.disabled}
                                    endIcon={<KeyboardArrowDown />}
                                    onClick={() => setHasFilter(true)}
                                >
                                    Filtration: get started
                                </Button>
                            </Box>
                        </Tooltip>
                    )}
                </Box>
            </StepContent>
        </Step>
    );
};

export default FiltrationStep;
