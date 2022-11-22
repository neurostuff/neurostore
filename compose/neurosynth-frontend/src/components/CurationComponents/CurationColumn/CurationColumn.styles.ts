import { Style } from 'index';

const CurationColumnStyles: Style = {
    columnContainer: {
        backgroundColor: 'rgb(244, 245, 247)',
        margin: '4px',
        padding: '0.75rem',
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        width: '300px',
        minWidth: '300px',
        flex: '1 1 0',
    },
    droppableContainer: {
        maxHeight: '800px',
        overflowY: 'scroll',
        flexGrow: 1,
        padding: '0.5rem',
    },
};

export default CurationColumnStyles;
