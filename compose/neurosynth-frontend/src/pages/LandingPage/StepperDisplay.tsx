import { Stepper, Step, StepLabel, Typography, StepContent } from '@mui/material';

const StepperDisplay: React.FC<{
    steps: {
        icon: JSX.Element;
        title: string;
        textContent: string;
    }[];
}> = (props) => {
    return (
        <Stepper orientation="vertical" sx={{ '.MuiStepConnector-root': { marginLeft: '28px' } }}>
            {props.steps.map((step) => (
                <Step
                    key={step.title}
                    sx={{
                        '.MuiSvgIcon-root': {
                            fontSize: '3.5rem',
                            paddingRight: '20px',
                        },
                        '.MuiStepContent-root': {
                            marginLeft: '28px',
                        },
                    }}
                    expanded={true}
                >
                    <StepLabel StepIconComponent={(_props) => step.icon}>
                        <Typography color="primary" variant="h5">
                            {step.title}
                        </Typography>
                    </StepLabel>
                    <StepContent>
                        <Typography sx={{ padding: '1rem 0' }} variant="h6">
                            {step.textContent}
                        </Typography>
                    </StepContent>
                </Step>
            ))}
        </Stepper>
    );
};
export default StepperDisplay;
