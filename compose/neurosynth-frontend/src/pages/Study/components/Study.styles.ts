import { Style } from 'index';

export const STUDY_ANALYSES_PANEL_HEIGHT = '80vh';

const StudyStyles: Style = {
    spaceBelow: {
        marginBottom: '8px !important',
    },
    metadataContainer: {
        maxHeight: {
            xs: '200px',
            md: '400px',
        },
        overflow: 'auto',
        overflowX: 'hidden',
        margin: '0 1rem',
    },
};

export default StudyStyles;
