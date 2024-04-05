import { Step, StepLabel, StepProps, Typography } from '@mui/material';

const ProjectPageCardStep: React.FC<
    StepProps & { isActive: boolean; optionalText: string; title: string }
> = (props) => {
    const { isActive, optionalText, title, ...stepProps } = props;

    return (
        <Step {...stepProps}>
            <StepLabel
                sx={{
                    '.Mui-completed': {
                        color: 'green !important',
                    },
                    '.Mui-active': {
                        color: 'orange !important',
                    },
                }}
                optional={props.optionalText}
            >
                <Typography fontWeight="bold">{props.title}</Typography>
            </StepLabel>
        </Step>
    );
};

export default ProjectPageCardStep;
