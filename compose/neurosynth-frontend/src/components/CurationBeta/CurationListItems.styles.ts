import { Style } from 'index';

const CurationListItemsStyles: Style = {
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
    },
};

export default CurationListItemsStyles;
