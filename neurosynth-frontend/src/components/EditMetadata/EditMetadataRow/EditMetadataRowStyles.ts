import makeStyles from '@mui/styles/makeStyles';

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
    updateButton: {
        width: '60px',
    },
}));

export default EditMetadataRowStyles;
