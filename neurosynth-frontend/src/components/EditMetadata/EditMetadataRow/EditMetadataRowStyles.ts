import { Style } from '../../..';

const EditMetadataRowStyles: Style = {
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
};

export default EditMetadataRowStyles;
