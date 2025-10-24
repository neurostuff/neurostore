import { Style } from 'index';

const EditStudyToolbarStyles: Style = {
    toolbarContainer: {
        position: 'sticky', // this is needed for when the toolbar is next to the edit study content
        top: '1rem',
        backgroundColor: 'white',
        zIndex: 1000,
        borderRadius: '4px',
        border: '1px solid',
        borderColor: 'primary.main',
        display: 'flex',
        flexDirection: {
            xs: 'row',
            md: 'column',
        },
    },
    header: {
        color: 'primary.contrastText',
        backgroundColor: 'primary.main',
        fontSize: '0.8rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: {
            xs: '10px',
            md: '10px 0',
        },
    },
    contentsContainer: {
        padding: {
            xs: '6px',
            md: '10px',
        },
        display: 'flex',
        boxSizing: 'border-box',
        flexDirection: {
            xs: 'row',
            md: 'column',
        },
        justifyContent: 'space-around',
        width: '100%',
    },
    showProgress: {
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'primary.main',
        fontSize: '10px',
        zIndex: 1,
        width: '40px',
        height: '40px',
    },
};

export default EditStudyToolbarStyles;
