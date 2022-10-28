import { Style } from 'index';

const ProjectComponentsStyles: Style = {
    stepCard: {
        width: '450px',
        borderRadius: '5px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    getStartedContainer: {
        height: '230px',
        border: '2px dashed',
    },
    step: {
        '.MuiStepIcon-root.MuiSvgIcon-root': {
            fontSize: '2.5rem',
            paddingRight: '24px',
        },
        '.MuiStepContent-root': {
            marginLeft: '20px',
        },
    },
};

export default ProjectComponentsStyles;
