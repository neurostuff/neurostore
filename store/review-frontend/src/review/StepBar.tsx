import { Step, StepButton, Stepper, Typography } from '@mui/material';
import { useSession, useView } from '../store/context';
import { stepProgress } from '../model/guided';
import { STEPS, type StepId } from '../model/steps';

function StepDone({ step }: { step: StepId }) {
    const showNonCoordinate = useView((s) => s.showNonCoordinate);
    const done = useSession((s) => {
        const progress = stepProgress({ ...s, showNonCoordinate }, step);
        return progress && `${progress.done} of ${progress.total}`;
    });
    return done ? <Typography variant="caption">{done}</Typography> : undefined;
}

export function StepBar() {
    const active = useView((s) => STEPS.findIndex((step) => step.id === s.step));
    const setStep = useView((s) => s.setStep);
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
