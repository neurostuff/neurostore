import { Style } from '../../..';

const DisplayMetadataTableRowStyles: Style = {
    string: {
        color: 'orange !important',
    },
    number: {
        color: 'blue !important',
    },
    boolean: {
        color: 'green !important',
    },
    none: {
        color: 'gray !important',
    },
    root: {
        wordBreak: {
            xs: 'break-all',
            md: 'keep-all',
        },
        fontSize: {
            xs: '0.8rem',
            md: 'initial',
        },
    },
};

export default DisplayMetadataTableRowStyles;
