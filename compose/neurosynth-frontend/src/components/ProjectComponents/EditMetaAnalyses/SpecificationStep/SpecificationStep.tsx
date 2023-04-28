import { Box, Button, Step, StepContent, StepLabel, StepProps, Typography } from '@mui/material';
import CreateMetaAnalysisSpecificationDialogBase from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase';
import { useState } from 'react';
import ProjectComponentsStyles from '../../ProjectComponents.styles';

interface ISpecificationStep {
    disabled: boolean;
}

const SpecificationStep: React.FC<ISpecificationStep & StepProps> = (props) => {
    const { disabled, ...stepProps } = props;
    const [
        showCreateMetaAnalysisSpecificationDialog,
        setShowCreateMetaAnalysisSpecificationDialog,
    ] = useState(false);

    return (
        <Step {...stepProps} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Select and Specify</b>: Select analyses and create the meta-analysis
                    specification.
                </Typography>
            </StepLabel>
            <StepContent>
                <CreateMetaAnalysisSpecificationDialogBase
                    isOpen={showCreateMetaAnalysisSpecificationDialog}
                    onCloseDialog={() => setShowCreateMetaAnalysisSpecificationDialog(false)}
                />
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
                    <Box
                        sx={[
                            ProjectComponentsStyles.stepCard,
                            {
                                height: '230px',
                            },
                        ]}
                    >
                        <Button
                            variant="outlined"
                            color="success"
                            onClick={() => setShowCreateMetaAnalysisSpecificationDialog(true)}
                            disabled={disabled}
                            sx={{ width: '100%', height: '100%' }}
                        >
                            create new meta-analysis specification
                        </Button>
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default SpecificationStep;
