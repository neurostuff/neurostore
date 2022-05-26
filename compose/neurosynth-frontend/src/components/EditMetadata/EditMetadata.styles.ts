import { Style } from '../..';

const EditMetadataStyles: Style = {
    table: {
        display: 'block',
        height: '100%',
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: '15px 0px',
    },
    tableOverflow: {
        maxHeight: {
            xs: '200px',
            md: '350px',
        },
        overflow: 'auto',
    },
    hr: {
        margin: '0px 0px 15px 0px',
    },
    noMetadataMessage: {
        color: 'warning.dark',
        marginBottom: '15px',
    },
};

export default EditMetadataStyles;
