import { Style } from '../..';

const EditMetadataStyles: Style = {
    grid: {
        display: 'grid',
        gridTemplateColumns: 'auto 1fr 1fr 70px',
        gap: 1,
    },
    hr: {
        gridColumn: '1 / -1',
        my: 2,
    },
};

export default EditMetadataStyles;
