import { Style } from 'index';

const EditStudyToolbarStyles: Style = {
    stickyContainer: {
        position: 'sticky',
        top: 15,
    },
    toolbarContainer: {
        position: 'absolute',
        right: 'calc(-8% - 18px)',
        borderRadius: '4px',
        border: '2px solid',
        borderColor: 'primary.main',
    },
    header: {
        color: 'primary.contrastText',
        backgroundColor: 'primary.main',
        fontSize: '0.8rem',
        textAlign: 'center',
        padding: '10px 0',
    },
    showProgress: {
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'primary.main',
        fontSize: '10px',
        zIndex: 1,
        width: '42px',
        height: '42px',
    },
    colorPulseAnimation: {
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
            '0%': {
                backgroundColor: 'success.light',
            },
            '50%': {
                backgroundColor: 'white',
            },
            '100%': {
                backgroundColor: 'success.light',
            },
        },
    },
};

export default EditStudyToolbarStyles;
