import { grey } from '@mui/material/colors';
import { Style } from '../../..';

const DatasetsTableStyles: Style = {
    tableRow: {
        '&:hover': {
            backgroundColor: grey[300],
            cursor: 'pointer',
            transition: '0.25s',
        },
    },
    headerCell: {
        color: 'white',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
    },
};

export default DatasetsTableStyles;
