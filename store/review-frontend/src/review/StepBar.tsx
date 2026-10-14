import { Step, StepButton, Stepper } from '@mui/material';
import { useReviewStore } from '../store/context';
import { STEPS } from './steps';

export function StepBar() {
    const active = useReviewStore((s) => STEPS.findIndex((step) => step.id === s.step));
    const setStep = useReviewStore((s) => s.setStep);
    return (
        <Stepper nonLinear activeStep={active} sx={{ px: 3, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            {STEPS.map((step) => (
                <Step key={step.id}>
                    <StepButton onClick={() => setStep(step.id)}>{step.label}</StepButton>
                </Step>
            ))}
        </Stepper>
    );
}
