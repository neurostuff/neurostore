import makeStyles from '@mui/styles/makeStyles';

const EditStudyPageStyles = makeStyles((theme) => ({
    saveButton: {
        borderColor: theme.palette.primary.main,
        color: theme.palette.primary.main,
        marginRight: '15px',
    },
    cancelButton: {
        borderColor: theme.palette.error.main,
        color: theme.palette.error.main,
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
