import makeStyles from '@mui/styles/makeStyles';

const DisplayMetadataTableRowStyles = makeStyles((theme) => ({
    type_string: {
        color: 'orange !important',
    },
    type_number: {
        color: 'blue !important',
    },
    type_boolean: {
        color: 'green !important',
    },
    type_other: {
        color: 'gray !important',
    },
}));

export default DisplayMetadataTableRowStyles;
