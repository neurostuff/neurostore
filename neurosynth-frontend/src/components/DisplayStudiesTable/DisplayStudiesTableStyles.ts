import { grey } from '@mui/material/colors';
import { Style } from '../..';

const DisplayStudiesTableStyles: Style = {
    root: {
        margin: '2% 0',
    },
    tableRow: {
        '&:hover': {
            backgroundColor: grey[200],
            cursor: 'pointer',
            transition: '0.25s',
        },
    },
    badge_neurosynth: {
        padding: '5px',
        borderRadius: '8px',
    },
    badge_user: {
        padding: '5px',
        borderRadius: '8px',
    },
};

export default DisplayStudiesTableStyles;
