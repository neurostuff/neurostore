import { Style } from '../../..';

const DisplayImageTableRowStyles: Style = {
    root: {
        '& > *': { borderBottom: 'unset !important' },
        '&:hover': {
            backgroundColor: 'primary.light',
            cursor: 'pointer',
            transition: '0.25s',
        },
    },
    selected: {
        backgroundColor: 'primary.main',
    },
};

export default DisplayImageTableRowStyles;
