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
        height: '8px',
    },
    noContent: {
        color: themes.palette.warning.dark,
    },
    nullContent: {
        color: 'blue',
        fontSize: '12px',
    },
    key: {
        minWidth: '300px',
    },
    updateButton: {
        width: '60px',
    },
    addMetadataTextfield: {
        width: '100%',
        '& .MuiOutlinedInput-input': {
            padding: '10px 14px !important',
            fontSize: '12px !important',
        },
    },
}));

export default EditMetadataRowStyles;
