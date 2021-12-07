import { grey } from '@mui/material/colors';
import { Style } from '../../..';

const StudiesTableStyles: Style = {
    tableRow: {
        '&:hover': {
            cursor: 'pointer',
            backgroundColor: grey[300],
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
    headerCell: {
        color: 'primary.contrastText',
        fontWeight: 'bold',
    },
};

export default StudiesTableStyles;
