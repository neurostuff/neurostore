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
import { useHistory, useParams } from 'react-router-dom';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';
import { IFiltrationMetadata } from 'hooks/requests/useGetProjects';
import { useState } from 'react';
import FiltrationDialog from 'components/Dialogs/FiltrationDialog/FiltrationDialog';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { getType } from 'components/EditMetadata';

interface IFiltrationStep {
    filtrationMetadata: IFiltrationMetadata | undefined;
    disabled: boolean;
}

const FiltrationStep: React.FC<IFiltrationStep & StepProps> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const history = useHistory();
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
                                            sx={{ marginRight: '40px' }}
                                        >
                                            Filter:
                                        </Typography>
                                        <Box>
                                            <Typography
                                                variant="h5"
                                                sx={{
                                                    color: NeurosynthTableStyles[
                                                        getType(filtrationMetadata?.filter?.type)
                                                    ],
                                                }}
                                            >
                                                {filtrationMetadata?.filter?.filtrationKey}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            onClick={() =>
                                                history.push(`/projects/${projectId}/curation`)
                                            }
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
