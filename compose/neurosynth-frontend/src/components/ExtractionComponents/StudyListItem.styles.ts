import { Style } from 'index';

const StudyListItemStyles: Style = {
    listItem: {
        display: 'flex',
        width: '100%',
        transition: '0.1s ease-in-out',
        padding: '1rem 0',
        ':hover': {
            backgroundColor: '#efefef',
            borderRadius: '8px',
            cursor: 'pointer',
        },
    },
};

export default StudyListItemStyles;
