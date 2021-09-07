import { makeStyles } from '@material-ui/core';

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
