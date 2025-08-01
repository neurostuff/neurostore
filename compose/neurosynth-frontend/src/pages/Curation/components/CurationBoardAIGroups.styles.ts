import { Style } from 'index';

const CurationBoardAIGroupsStyles: Style = {
    listItem: {
        '& .MuiListItemButton-root.Mui-selected': {
            backgroundColor: 'white',
        },
    },
    listItemButton: {
        borderTopLeftRadius: '4px',
        borderBottomLeftRadius: '4px',
    },
    listSubheader: {
        backgroundColor: 'rgb(242, 242, 242)',
        color: '#9d9d9d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lineClamp3: {
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        wordBreak: 'break-word',
    },
};

export default CurationBoardAIGroupsStyles;
