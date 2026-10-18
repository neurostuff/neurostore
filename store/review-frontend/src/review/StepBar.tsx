import { Step, StepButton, Stepper, Typography, type StepProps } from '@mui/material';
import { useSession, useView } from '../store/context';
import { STEPS } from '../model/steps';
import { Hint } from './Hint';
import { selectStepProgress } from './stepCount';

function StepItem({ step, ...position }: StepProps & { step: (typeof STEPS)[number] }) {
    const progress = useSession((s) => selectStepProgress(s, step.id));
    const setStep = useView((s) => s.setStep);
    return (
        <Step {...position} completed={progress.complete}>
            <Hint title={`${step.hint} (Alt+Shift+J and Alt+Shift+K move between steps)`}>
                <StepButton
                    optional={progress.text ? <Typography variant="caption">{progress.text}</Typography> : undefined}
                    onClick={() => setStep(step.id)}
                >
                    {step.label}
                </StepButton>
            </Hint>
        </Step>
    );
}

export function StepBar() {
    const active = useView((s) => STEPS.findIndex((step) => step.id === s.step));
    return (
        <Stepper nonLinear activeStep={active} sx={{ px: 3, py: 1.5 }}>
            {STEPS.map((step) => (
                <StepItem key={step.id} step={step} />
            ))}
        </Stepper>
    );
}
