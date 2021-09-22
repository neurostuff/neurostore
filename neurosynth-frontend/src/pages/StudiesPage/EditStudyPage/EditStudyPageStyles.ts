import { makeStyles } from '@mui/styles';

const EditStudyPageStyles = makeStyles((theme) => ({
    saveButton: {
        marginRight: '15px !important',
    },
    button: {
        width: '160px',
    },
    stickyButtonContainer: {
        backgroundColor: 'white',
        zIndex: 2,
        width: '100%',
        position: 'sticky',
        padding: '20px 0px',
        top: '0',
    },
}));

export default EditStudyPageStyles;
