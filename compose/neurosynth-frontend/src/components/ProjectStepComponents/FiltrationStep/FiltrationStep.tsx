import {
    Box,
    Step,
    StepContent,
    StepLabel,
    StepProps,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
} from '@mui/material';
import { useHistory, useParams } from 'react-router-dom';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';
import { IFiltrationMetadata } from 'hooks/requests/useGetProjects';
import { useState } from 'react';
import FiltrationDialog from 'components/Dialogs/FiltrationDialog/FiltrationDialog';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { EPropertyType } from 'components/EditMetadata';

interface IFiltrationStep {
    filtrationMetadata: IFiltrationMetadata | undefined;
    disabled: boolean;
}

const FiltrationStep: React.FC<IFiltrationStep & StepProps> = (props) => {
    const [filtrationDialogIsOpen, setFiltrationDialogIsOpen] = useState(false);
    const { filtrationMetadata, disabled, ...stepProps } = props;

    const filterExists = !!filtrationMetadata;

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Filtration</b>: Select the analyses to include
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>
                            Your studyset's studies now have all the relevant information (i.e.
                            metadata, coordinates, annotations) needed for a meta-analysis
                        </b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        In this step, select the analyses from each study that you want to include
                        in the meta-analysis based on your analysis annotations
                    </Typography>
                    <FiltrationDialog
                        isOpen={filtrationDialogIsOpen}
                        onCloseDialog={() => setFiltrationDialogIsOpen(false)}
                    />
                    <Box sx={{ marginTop: '1rem' }}>
                        {filterExists ? (
                            <Box sx={[ProjectStepComponentsStyles.stepCard]}>
                                <Card sx={{ width: '100%', height: '100%' }}>
                                    <CardContent>
                                        <Typography
                                            gutterBottom
                                            variant="h5"
                                            sx={{ marginBottom: '1.5rem' }}
                                        >
                                            Filter:
                                        </Typography>
                                        <Box>
                                            <Typography
                                                variant="h5"
                                                sx={{
                                                    fontWeight: 'bold',
                                                    color: NeurosynthTableStyles[
                                                        filtrationMetadata?.filter?.type ||
                                                            EPropertyType.NONE
                                                    ],
                                                }}
                                            >
                                                {filtrationMetadata?.filter?.filtrationKey}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            onClick={() => setFiltrationDialogIsOpen(true)}
                                            variant="text"
                                        >
                                            update filter
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
                                    onClick={() => setFiltrationDialogIsOpen(true)}
                                    disabled={disabled}
                                    sx={{ width: '100%', height: '100%' }}
                                >
                                    filtration: get started
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
