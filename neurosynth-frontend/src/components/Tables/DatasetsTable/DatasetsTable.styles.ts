import { grey } from '@mui/material/colors';
import { Style } from '../../..';

const DatasetsTableStyles: Style = {
    tableRow: {
        '&:hover': {
            backgroundColor: grey[200],
            cursor: 'pointer',
            transition: '0.25s',
        },
    },
};

export default DatasetsTableStyles;
