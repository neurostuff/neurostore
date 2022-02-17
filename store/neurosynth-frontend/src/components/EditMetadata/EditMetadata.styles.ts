import { Style } from '../..';

const EditMetadataStyles: Style = {
    table: {
        display: 'block',
        maxHeight: {
            xs: '200px',
            md: '350px',
        },
        overflow: 'auto',
        height: '100%',
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: '15px 0px',
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
