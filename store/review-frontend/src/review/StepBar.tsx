import { Step, StepButton, Stepper, Typography } from '@mui/material';
import { useReviewStore } from '../store/context';
import { stepProgress } from './guided';
import { STEPS, type StepId } from './steps';

function StepDone({ step }: { step: StepId }) {
    const done = useReviewStore((s) => {
        const progress = stepProgress(s, step);
        return progress && `${progress.done} of ${progress.total}`;
    });
    return done ? <Typography variant="caption">{done}</Typography> : undefined;
}

export function StepBar() {
    const active = useReviewStore((s) => STEPS.findIndex((step) => step.id === s.step));
    const setStep = useReviewStore((s) => s.setStep);
    return (
        <Stepper nonLinear activeStep={active} sx={{ px: 3, py: 1.5 }}>
            {STEPS.map((step) => (
                <Step key={step.id}>
                    <StepButton optional={<StepDone step={step.id} />} onClick={() => setStep(step.id)}>
                        {step.label}
                    </StepButton>
                </Step>
            ))}
        </Stepper>
    );
}
