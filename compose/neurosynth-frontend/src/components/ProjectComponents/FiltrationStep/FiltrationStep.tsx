import { StepProps, Step, StepLabel, Typography, StepContent, Box } from '@mui/material';
import { useState } from 'react';
import ProjectComponentsStyles from '../ProjectComponents.styles';

interface IFiltrationStep {}

const FiltrationStep: React.FC<IFiltrationStep & StepProps> = (props) => {
    const [hasFilter, setHasFilter] = useState(false);

    return (
        <Step {...props} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: hasFilter ? 'primary.main' : 'muted.main' }} variant="h6">
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
                </Box>
            </StepContent>
        </Step>
    );
};

export default FiltrationStep;
