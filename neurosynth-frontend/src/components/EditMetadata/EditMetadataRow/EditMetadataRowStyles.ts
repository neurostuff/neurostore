import { makeStyles } from '@material-ui/core';

const EditMetadataRowStyles = makeStyles((themes) => ({
    tableRow: {
        display: 'table-row',
        height: '100%',
    },
    addMetadata: {
        marginBottom: '15px',
    },
    tableCell: {
        display: 'table-cell',
        height: '100%',
        verticalAlign: 'middle',
    },
    spacer: {
        height: '10px',
    },
    noContent: {
        color: themes.palette.warning.dark,
    },
    nullContent: {
        color: 'blue',
    },
    key: {
        minWidth: '300px',
    },
    error: {
        color: themes.palette.error.main,
    },
    updateButton: {
        width: '60px',
    },
}));

export default EditMetadataRowStyles;
