import makeStyles from '@mui/styles/makeStyles';

const EditMetadataFieldsStyles = makeStyles((themes) => ({
    checkedTrue: {
        color: themes.palette.primary.main,
    },
    checkedFalse: {
        color: themes.palette.secondary.main,
    },
    textfield: {
        width: '100%',
        '& .MuiOutlinedInput-root': {
            padding: '10px 14px !important',
            fontSize: '12px !important',
        },
    },
    numberfield: {
        width: '100%',
        '& .MuiOutlinedInput-input': {
            padding: '10px 14px !important',
            fontSize: '12px !important',
        },
    },
}));

export default EditMetadataFieldsStyles;
