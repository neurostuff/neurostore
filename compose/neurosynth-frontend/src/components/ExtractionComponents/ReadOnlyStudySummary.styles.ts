import { Style } from 'index';

const StudyListItemStyles: Style = {
    listItem: {
        display: 'flex',
        padding: '10px',
        width: 'calc(100% - 20px)',
        height: 'calc(100% - 20px)',
        transition: '0.1s ease-in-out',
        ':hover': {
            backgroundColor: '#efefef',
            borderRadius: '8px',
            cursor: 'pointer',
        },
    },
};

export default StudyListItemStyles;
