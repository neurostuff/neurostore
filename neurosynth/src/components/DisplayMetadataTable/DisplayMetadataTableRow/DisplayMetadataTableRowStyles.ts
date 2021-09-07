import { makeStyles } from '@material-ui/core';

const DisplayMetadataTableRowStyles = makeStyles((theme) => ({
    type_string: {
        color: 'orange',
    },
    type_number: {
        color: 'blue',
    },
    type_boolean: {
        color: 'green',
    },
    type_other: {
        color: 'gray',
    },
}));

export default DisplayMetadataTableRowStyles;
