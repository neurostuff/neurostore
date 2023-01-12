import { Style } from 'index';

const ProjectStepComponentsStyles: Style = {
    stepCard: {
        width: '450px',
        borderRadius: '5px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '230px',
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
    stepTitle: {
        display: 'flex',
        justifyContent: 'space-between',
        position: 'relative',
    },
    divider: {
        margin: '0 20px',
    },
    statusContainer: {
        marginTop: '1.5rem',
        display: 'flex',
    },
    statusIconContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexGrow: 1,
    },
    progressCircle: {
        position: 'absolute',
        right: 0,
        backgroundColor: '#ededed',
        borderRadius: '50%',
    },
};

export default ProjectStepComponentsStyles;
