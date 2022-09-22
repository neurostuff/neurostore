import { grey } from '@mui/material/colors';
import { Style } from '../../..';

const NeurosynthTableStyles: Style = {
    tableRow: {
        '&:hover': {
            cursor: 'pointer',
            backgroundColor: grey[300],
            transition: '0.25s',
        },
    },
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
};

export default NeurosynthTableStyles;
