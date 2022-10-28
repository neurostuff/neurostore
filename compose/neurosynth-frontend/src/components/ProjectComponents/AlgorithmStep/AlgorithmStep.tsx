import { Step, StepLabel, StepContent, Typography, Box, Button, StepProps } from '@mui/material';
import { useState } from 'react';
import ProjectComponentsStyles from '../ProjectComponents.styles';

interface IAlgorithmStep {}

const AlgorithmStep: React.FC<IAlgorithmStep & StepProps> = (props) => {
    const { ...stepProps } = props;
    const [hasAlgorithm, setHasAlgorithm] = useState(false);

    return (
        <Step {...stepProps} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography
                    sx={{ color: hasAlgorithm ? 'primary.main' : 'muted.main' }}
                    variant="h6"
                >
                    <b>Algorithm</b>: Select the desired algorithm and associated arguments
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        <b>
                            You have a finalized studyset full of studies that have all relevant
                            data and annotations. You have selected the analyses you would like to
                            use for your meta-analysis.
                        </b>
                        In this step, select the meta-analytic algorithm you would like to use as
                        well as any associated configurations (like kernel size, number of
                        iterations, and an associated corrector)
                    </Typography>
                    <Button
                        color="primary"
                        disabled={!hasAlgorithm}
                        size="large"
                        variant="contained"
                    >
                        RUN META-ANALYSIS
                    </Button>
                </Box>
            </StepContent>
        </Step>
    );
};

export default AlgorithmStep;
