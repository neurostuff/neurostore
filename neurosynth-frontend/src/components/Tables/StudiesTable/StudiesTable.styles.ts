import { Style } from '../../..';

const StudiesTableStyles: Style = {
    tableRow: {
        '&:hover': {
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

export default StudiesTableStyles;
