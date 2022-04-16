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
        minWidth: '240px',
        // override tableCell as this input has an error message
        verticalAlign: 'baseline !important',
    },
    updateButton: {
        width: '60px',
    },
    addMetadataTextfield: {
        width: '100%',
        height: '40px',
    },
};

export default EditMetadataRowStyles;
