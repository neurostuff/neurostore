import { Style } from 'index';

const EditStudyToolbarStyles: Style = {
    stickyContainer: {
        position: 'sticky',
        top: 15,
    },
    toolbarContainer: {
        position: 'absolute',
        right: '-9%',
        transform: 'translateX(-8px)',
        borderRadius: '4px',
        border: '1px solid',
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
};

export default EditStudyToolbarStyles;
