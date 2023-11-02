import { Style } from '../../..';

const EditStudyPageStyles: Style = {
    loadingButtonContainer: {
        bottom: 0,
        height: '40px',
        padding: '0.75rem 0',
        backgroundColor: 'white',
        position: 'fixed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: {
            xs: '90%',
            md: '80%',
        },
        zIndex: 1000,
    },
};

export default EditStudyPageStyles;
