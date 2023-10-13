import { Style } from '../..';

const PlatformComparisonTableStyles: Style = {
    cell: {
        color: 'secondary.contrastText',
        fontSize: {
            xs: '1rem',
            md: '1.5rem',
        },
        textAlign: 'center',
        borderBottom: 'none',
        padding: {
            xs: '10px !important',
            sm: '16px',
        },
    },
    cellIcon: {
        fontSize: {
            xs: '2.5rem',
            md: '3rem',
        },
    },
    cellColHeader: {
        color: 'secondary.contrastText',
        fontSize: {
            xs: '1rem',
            md: '1.8rem',
        },
        textAlign: 'center',
        borderBottom: 'none',
        width: {
            xs: '33%',
            md: '37%',
        },
        padding: {
            xs: '10px !important',
            sm: '16px',
        },
    },
    cellRowHeader: {
        color: 'secondary.contrastText',
        fontSize: {
            xs: '1rem',
            md: '1.5rem',
        },
        borderBottom: 'none',
        width: {
            xs: '33%',
            md: '26%',
        },
    },
};

export default PlatformComparisonTableStyles;
