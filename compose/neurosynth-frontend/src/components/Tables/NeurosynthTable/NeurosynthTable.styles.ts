import grey from '@mui/material/colors/grey';
import { Style } from '../../..';

const NeurosynthTableStyles: Style = {
    tableRow: {
        '&:hover': {
            cursor: 'pointer',
            backgroundColor: grey[300],
            transition: '0.25s',
        },
    },
};

export default NeurosynthTableStyles;
