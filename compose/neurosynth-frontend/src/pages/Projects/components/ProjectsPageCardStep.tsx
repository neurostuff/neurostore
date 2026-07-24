import { Step, StepLabel, StepProps, Typography } from '@mui/material';
import React from 'react';

const ProjectsPageCardStep = (props: StepProps & { title: string; optionalText?: React.ReactNode; isActive?: boolean }) => {
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

export default ProjectsPageCardStep;
