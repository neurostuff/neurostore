import makeStyles from '@mui/styles/makeStyles';

const EditMetadataFieldsStyles = makeStyles((themes) => ({
    checkedTrue: {
        color: themes.palette.primary.main,
    },
    checkedFalse: {
        color: themes.palette.secondary.main,
    },
    w_100: {
        width: '100%',
    },
}));

export default EditMetadataFieldsStyles;
